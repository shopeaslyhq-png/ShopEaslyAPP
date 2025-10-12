package com.google.genai.types;

import java.util.Optional;

public class Part {
    private String text;
    private Blob inlineData;

    public static Part fromText(String t) { Part p = new Part(); p.text = t; return p; }

    public String text() { return text; }
    public Optional<Blob> inlineData() { return Optional.ofNullable(inlineData); }
}
