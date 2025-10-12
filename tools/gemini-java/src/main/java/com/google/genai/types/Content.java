package com.google.genai.types;

import java.util.List;
import java.util.Optional;

public class Content {
    private List<Part> parts;

    public static Content fromParts(Part... parts) {
        Content c = new Content();
        c.parts = List.of(parts);
        return c;
    }

    public Optional<List<Part>> parts() {
        return Optional.ofNullable(parts);
    }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private String role;
        private List<Part> parts;

        public Builder role(String r) { this.role = r; return this; }
        public Builder parts(List<Part> p) { this.parts = p; return this; }
        public Content build() { Content c = new Content(); c.parts = this.parts; return c; }
    }
}
