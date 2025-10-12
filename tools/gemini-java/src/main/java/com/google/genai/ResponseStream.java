package com.google.genai;

import java.util.Iterator;
import java.util.NoSuchElementException;

/**
 * Simple empty ResponseStream mock that implements AutoCloseable and Iterable.
 */
public class ResponseStream<T> implements Iterable<T>, AutoCloseable {
    @Override
    public void close() { }

    @Override
    public Iterator<T> iterator() {
        return new Iterator<T>() {
            @Override
            public boolean hasNext() {
                return false;
            }

            @Override
            public T next() {
                throw new NoSuchElementException();
            }
        };
    }
}
