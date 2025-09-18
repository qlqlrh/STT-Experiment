package com.example.stt.ws;

import com.example.stt.stt.GoogleSpeechService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.cloud.speech.v1.RecognitionConfig;
import com.google.cloud.speech.v1.StreamingRecognitionConfig;
import com.google.cloud.speech.v1.StreamingRecognizeResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.nio.ByteBuffer;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class AudioWebSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper mapper = new ObjectMapper();
    private final Map<String, SessionCtx> sessions = new ConcurrentHashMap<>();

    @Value("${app.stt.credentials}")
    private String credentialsPath;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        // no-op
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        JsonNode node = mapper.readTree(payload);
        String type = node.path("type").asText("");
        if ("init".equals(type)) {
            String segmentId = node.path("segmentId").asText();
            int sampleRateHz = node.path("sampleRateHz").asInt(16000);
            String languageCode = node.path("languageCode").asText("en-US");
            int threads = node.path("threads").asInt(1);
            String bufferPolicyStr = node.path("bufferPolicy").asText("UNBOUNDED");
            int queueCapacity = node.path("queueCapacity").asInt(0);

            SessionCtx.BufferPolicy policy = SessionCtx.BufferPolicy.valueOf(bufferPolicyStr);

            RecognitionConfig recConfig = RecognitionConfig.newBuilder()
                    .setEncoding(RecognitionConfig.AudioEncoding.LINEAR16)
                    .setLanguageCode(languageCode)
                    .setSampleRateHertz(sampleRateHz)
                    .build();
            StreamingRecognitionConfig streamingConfig = StreamingRecognitionConfig.newBuilder()
                    .setInterimResults(true)
                    .setSingleUtterance(false)
                    .setConfig(recConfig)
                    .build();

            GoogleSpeechService speechService = new GoogleSpeechService(credentialsPath);
            GoogleSpeechService.StreamingSession streamingSession = speechService.startStreaming(
                    streamingConfig,
                    (StreamingRecognizeResponse resp) -> {
                        if (resp.getResultsCount() > 0 && resp.getResults(0).getAlternativesCount() > 0) {
                            boolean isFinal = resp.getResults(0).getIsFinal();
                            String transcript = resp.getResults(0).getAlternatives(0).getTranscript();
                            if (isFinal) {
                                long t4 = System.nanoTime() / 1_000_000;
                                long epoch = System.currentTimeMillis();
                                try {
                                    SessionCtx ctx = sessions.get(session.getId());
                                    double dropRate = (ctx != null) ? ctx.getDropRate() : 0.0;
                                    String msg = mapper.createObjectNode()
                                            .put("type", "SVR_T4_FINAL")
                                            .put("t4_ms", t4)
                                            .put("server_epoch_ms", epoch)
                                            .put("drop_rate", dropRate)
                                            .put("transcript", transcript)
                                            .toString();
                                    session.sendMessage(new TextMessage(msg));
                                } catch (Exception ignored) { }
                            }
                        }
                    },
                    (Throwable err) -> { },
                    () -> { }
            );

            SessionCtx ctx = new SessionCtx(segmentId, policy, queueCapacity, threads, streamingSession);
            sessions.put(session.getId(), ctx);

            for (int i = 0; i < Math.max(1, threads); i++) {
                ctx.workerPool.submit(() -> {
                    try {
                        while (!Thread.currentThread().isInterrupted()) {
                            byte[] chunk = ctx.take();
                            if (!ctx.firstChunkPushed) {
                                ctx.firstChunkPushed = true;
                                ctx.t3Millis = System.nanoTime() / 1_000_000;
                                long epoch = System.currentTimeMillis();
                                try {
                                    String t3Msg = mapper.createObjectNode()
                                            .put("type", "SVR_T3")
                                            .put("t3_ms", ctx.t3Millis)
                                            .put("server_epoch_ms", epoch)
                                            .toString();
                                    session.sendMessage(new TextMessage(t3Msg));
                                } catch (Exception ignored) { }
                            }
                            ctx.streamingSession.sendAudioChunk(chunk);
                        }
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                    }
                });
            }
        } else if ("end".equals(type)) {
            SessionCtx ctx = sessions.remove(session.getId());
            if (ctx != null) {
                ctx.shutdown();
            }
        }
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) {
        SessionCtx ctx = sessions.get(session.getId());
        if (ctx == null) return;
        ByteBuffer buf = message.getPayload();
        byte[] bytes = new byte[buf.remaining()];
        buf.get(bytes);
        ctx.enqueue(bytes);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        SessionCtx ctx = sessions.remove(session.getId());
        if (ctx != null) {
            ctx.shutdown();
        }
    }
}


