# ShopEasly Gemini Java Tool

Small Maven-based tool to call the Gemini (GenAI) model and save generated images to disk.

## Requirements
- Java 17+
- Maven
- Environment variable `GEMINI_API_KEY` set with a valid API key

## Build

```bash
mvn -f tools/gemini-java package
```

This will create a fat/shaded jar under `tools/gemini-java/target/gemini-java-1.0.0.jar`.

## Run

```bash
GEMINI_API_KEY=your_key_here java -jar tools/gemini-java/target/gemini-java-1.0.0.jar
```

The tool will print text responses to stdout and write binary images to the current working directory.

## Notes
- The `com.google.genai:genai` dependency in `pom.xml` is a placeholder; please replace it with the correct coordinates for the Gemini Java client if different.
- If Maven fails to resolve the GenAI client, consult your organization's artifact repository or the official client docs.
 - If you have the GenAI client coordinates available, you can build with the profile that includes it:

```bash
mvn -f tools/gemini-java -P with-genai package
```

Alternatively, install the GenAI client jar into your local Maven repository and run the normal package command.

## Enabling the real GenAI client (and removing mocks)

1. Replace the placeholder dependency coordinates in `pom.xml` with the official GenAI client coordinates (or enable the `with-genai` profile if configured).
2. Remove the mock classes under `tools/gemini-java/src/main/java/com/google/genai` (or move them to a test-only source set). The mock classes are present so `mvn package` works without the real client, but at runtime they will throw an informative IllegalStateException if used.
3. Build with the GenAI client available:

```bash
mvn -f tools/gemini-java -P with-genai package
```

After that, run the jar normally with `GEMINI_API_KEY` set.