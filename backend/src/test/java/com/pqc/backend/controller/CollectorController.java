
package com.pqc.backend.controller;

import java.util.Map;
import java.util.LinkedHashMap;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/collector")
public class CollectorController {

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of(
            "status", "online",
            "component", "PQC-SOFT Console"
        );
    }

    @PostMapping("/heartbeat")
    public Map<String, Object> receiveHeartbeat(
            @RequestBody Map<String, Object> data) {

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("received", true);
        response.put("message", "Collector reçu par la Console");
        response.put("collectorData", data);

        return response;
    }
}