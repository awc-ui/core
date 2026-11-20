package dev.awc.nativeui

import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.junit.Assert.assertNull
import org.junit.Test

/** 6-1 routed item 1: snapshot() from the instrumentation thread while the UI thread records and removes nodes. */
class AWCInspectionCollectorStressTest {
    private fun node(i: Int) = AWCInspectionNode("n$i", "Node", AWCInspectionBounds(i.toDouble(), 0.0, 10.0, 10.0))

    @Test fun snapshotWhileRecordingDoesNotThrow() {
        val collector = AWCInspectionCollector()
        val failure = AtomicReference<Throwable?>(null)
        val deadline = System.nanoTime() + 3_000_000_000L
        val writer = thread {
            try {
                var i = 0
                while (System.nanoTime() < deadline && failure.get() == null) {
                    val owner = Any()
                    for (k in 0 until 50) collector.record(owner, node(i + k))
                    for (k in 0 until 50) collector.remove(owner, "n${i + k}")
                    i = (i + 7) % 500
                }
            } catch (t: Throwable) { failure.compareAndSet(null, t) }
        }
        val readers = (0 until 3).map {
            thread {
                try { while (System.nanoTime() < deadline && failure.get() == null) collector.snapshot().nodes.size }
                catch (t: Throwable) { failure.compareAndSet(null, t) }
            }
        }
        writer.join(); readers.forEach { it.join() }
        assertNull("collector raced: ${failure.get()}", failure.get())
    }
}
