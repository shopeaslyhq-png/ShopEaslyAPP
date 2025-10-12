package com.google.genai.types;

import java.util.List;

public class GenerateContentConfig {
    private List<String> responseModalities;
    private Content systemInstruction;

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private List<String> responseModalities;
        private Content systemInstruction;

        public Builder responseModalities(List<String> r) { this.responseModalities = r; return this; }
        public Builder systemInstruction(Content c) { this.systemInstruction = c; return this; }
        public GenerateContentConfig build() { GenerateContentConfig g = new GenerateContentConfig(); g.responseModalities = this.responseModalities; g.systemInstruction = this.systemInstruction; return g; }
    }
}
