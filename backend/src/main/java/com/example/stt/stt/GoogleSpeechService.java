package com.example.stt.stt;

import com.google.api.gax.rpc.ClientStream;
import com.google.api.gax.rpc.ResponseObserver;
import com.google.api.gax.rpc.StreamController;
import com.google.api.gax.core.FixedCredentialsProvider;
import com.google.auth.oauth2.ServiceAccountCredentials;
import com.google.cloud.speech.v1.*;
import com.google.protobuf.ByteString;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

public class GoogleSpeechService {

    private final String credentialsPath;

    public GoogleSpeechService(String credentialsPath) {
        this.credentialsPath = credentialsPath;
    }

    public StreamingSession startStreaming(StreamingRecognitionConfig streamingConfig,
                                           java.util.function.Consumer<StreamingRecognizeResponse> onResponse,
                                           java.util.function.Consumer<Throwable> onError,
                                           Runnable onCompleted) throws IOException {
        ServiceAccountCredentials credentials;
        try (InputStream credentialsStream = openCredentialsInputStream(credentialsPath)) {
            credentials = ServiceAccountCredentials.fromStream(credentialsStream);
        }
        SpeechSettings settings = SpeechSettings.newBuilder()
                .setCredentialsProvider(FixedCredentialsProvider.create(credentials))
                .build();
        SpeechClient client = SpeechClient.create(settings);

        ResponseObserver<StreamingRecognizeResponse> responseObserver = new ResponseObserver<>() {
            @Override
            public void onStart(StreamController controller) { }
            @Override
            public void onResponse(StreamingRecognizeResponse response) { onResponse.accept(response); }
            @Override
            public void onComplete() { onCompleted.run(); }
            @Override
            public void onError(Throwable t) { onError.accept(t); }
        };

        ClientStream<StreamingRecognizeRequest> requestObserver = client.streamingRecognizeCallable().splitCall(responseObserver);

        StreamingRecognizeRequest request = StreamingRecognizeRequest.newBuilder()
                .setStreamingConfig(streamingConfig)
                .build();
        requestObserver.send(request);

        return new StreamingSession(client, requestObserver);
    }

    private static InputStream openCredentialsInputStream(String path) throws IOException {
        if (path == null || path.isBlank()) {
            throw new IOException("Credentials path is null or empty");
        }

        String trimmed = path.trim();
        String classpathPrefix = "classpath:";
        String filePrefix = "file:";

        if (trimmed.startsWith(classpathPrefix)) {
            String resourcePath = trimmed.substring(classpathPrefix.length());
            if (resourcePath.startsWith("/")) {
                resourcePath = resourcePath.substring(1);
            }
            ClassLoader cl = Thread.currentThread().getContextClassLoader();
            InputStream in = cl != null ? cl.getResourceAsStream(resourcePath) : GoogleSpeechService.class.getClassLoader().getResourceAsStream(resourcePath);
            if (in == null) {
                throw new IOException("Classpath resource not found: " + resourcePath);
            }
            return in;
        }

        if (trimmed.startsWith(filePrefix)) {
            String filePath = trimmed.substring(filePrefix.length());
            return Files.newInputStream(Path.of(filePath));
        }

        // Treat as plain filesystem path
        return new FileInputStream(trimmed);
    }

    public static class StreamingSession {
        private final SpeechClient client;
        private final ClientStream<StreamingRecognizeRequest> requestObserver;
        private boolean finished = false;

        public StreamingSession(SpeechClient client, ClientStream<StreamingRecognizeRequest> requestObserver) {
            this.client = client;
            this.requestObserver = requestObserver;
        }

        public void sendAudioChunk(byte[] audio) {
            if (finished) return;
            StreamingRecognizeRequest request = StreamingRecognizeRequest.newBuilder()
                    .setAudioContent(ByteString.copyFrom(audio))
                    .build();
            requestObserver.send(request);
        }

        public void finishStreaming() {
            if (finished) return;
            finished = true;
            requestObserver.closeSend();
            client.close();
        }
    }
}


