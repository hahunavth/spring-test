package com.hahunavth.netcomic.Getting;

import java.util.concurrent.atomic.AtomicLong;

import com.hahunavth.netcomic.Getting.Getting;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class GettingController {
    private static final String template = "Hello %s!";
    private final AtomicLong counter = new AtomicLong();

    @GetMapping(value = "/getting")
    public Getting getting (@RequestParam(value = "name", defaultValue = "World") String name) {
        return new Getting (counter.incrementAndGet(), String.format(template, name));
    }
}
