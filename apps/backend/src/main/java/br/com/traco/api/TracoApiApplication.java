package br.com.traco.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class TracoApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(TracoApiApplication.class, args);
    }
}