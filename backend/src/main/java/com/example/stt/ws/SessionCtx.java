package com.example.stt.ws;

import com.example.stt.stt.GoogleSpeechService;

import java.util.ArrayDeque;
import java.util.Queue;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class SessionCtx {
    public enum BufferPolicy { UNBOUNDED, BOUNDED_DROP_NEWEST, BOUNDED_DROP_OLDEST }

    public final String segmentId;
    public final BufferPolicy bufferPolicy;
    public final int queueCapacity;
    public final ExecutorService workerPool;
    public final GoogleSpeechService.StreamingSession streamingSession;

    private final Queue<byte[]> unboundedQueue;
    private final ArrayBlockingQueue<byte[]> boundedQueue;

    public volatile Long t3Millis = null;
    public volatile boolean firstChunkPushed = false;

    public SessionCtx(String segmentId, BufferPolicy policy, int capacity, int threads, GoogleSpeechService.StreamingSession session) {
        this.segmentId = segmentId;
        this.bufferPolicy = policy;
        this.queueCapacity = capacity;
        this.streamingSession = session;
        this.workerPool = Executors.newFixedThreadPool(Math.max(1, threads));
        this.unboundedQueue = new ArrayDeque<>();
        this.boundedQueue = capacity > 0 ? new ArrayBlockingQueue<>(capacity) : null;
    }

    public void enqueue(byte[] data) {
        switch (bufferPolicy) {
            case UNBOUNDED -> { synchronized (unboundedQueue) { unboundedQueue.add(data); unboundedQueue.notifyAll(); } }
            case BOUNDED_DROP_NEWEST -> { if (!boundedQueue.offer(data)) { /* drop newest */ } }
            case BOUNDED_DROP_OLDEST -> { if (!boundedQueue.offer(data)) { boundedQueue.poll(); boundedQueue.offer(data); } }
        }
    }

    public byte[] take() throws InterruptedException {
        return switch (bufferPolicy) {
            case UNBOUNDED -> { synchronized (unboundedQueue) { while (unboundedQueue.isEmpty()) { unboundedQueue.wait(); } yield unboundedQueue.poll(); } }
            case BOUNDED_DROP_NEWEST, BOUNDED_DROP_OLDEST -> boundedQueue.take();
        };
    }

    public void shutdown() {
        workerPool.shutdownNow();
        streamingSession.finishStreaming();
    }
}


