package com.example.stt.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

@Configuration
public class WebSocketContainerConfig {

    @Bean
    public ServletServerContainerFactoryBean createWebSocketContainer() {
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        // 8192 samples(16-bit PCM) = 16KB. 기본 8KB 제한을 충분히 상회하도록 상향.
        container.setMaxBinaryMessageBufferSize(512 * 1024); // 512KB
        container.setMaxTextMessageBufferSize(128 * 1024);   // 128KB (여유)
        container.setMaxSessionIdleTimeout(600_000L);        // 10분
        return container;
    }
}


