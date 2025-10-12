package com.google.genai.types;

import java.util.Optional;

public class Blob {
    private Optional<byte[]> data = Optional.empty();
    private Optional<String> mimeType = Optional.empty();

    public Optional<byte[]> data() { return data; }
    public Optional<String> mimeType() { return mimeType; }

    public static Blob fromBytes(byte[] b, String mime) { Blob bl = new Blob(); bl.data = Optional.ofNullable(b); bl.mimeType = Optional.ofNullable(mime); return bl; }
}
