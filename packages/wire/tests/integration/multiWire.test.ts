import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryWire, createWire } from '../../src/index';

describe('Multi-Wire Integration', () => {
  const wires: ReturnType<typeof createWire>[] = [];

  afterEach(async () => {
    // Close all wires
    for (const wire of wires) {
      await wire.close();
    }
    wires.length = 0;
  });

  it('should isolate messages between different wire instances', async () => {
    // Create two separate Wire instances with different IDs
    const wire1 = createWire(createMemoryWire('wire1'));
    const wire2 = createWire(createMemoryWire('wire2'));
    wires.push(wire1, wire2);

    // Track which receivers process which messages
    const wire1Messages: string[] = [];
    const wire2Messages: string[] = [];

    // Create receivers on both wires for the same topic
    const receiver1 = wire1.createReceiver(async (topic, payload) => {
      wire1Messages.push(payload as string);
      return { wire: 'wire1', payload };
    });

    const receiver2 = wire2.createReceiver(async (topic, payload) => {
      wire2Messages.push(payload as string);
      return { wire: 'wire2', payload };
    });

    await receiver1.start();
    await receiver2.start();

    // Create senders on both wires
    const sender1 = wire1.createSender();
    const sender2 = wire2.createSender();

    // Send messages to the same topic on different wires
    const response1 = await sender1.send('shared-topic', 'message-for-wire1');
    const response2 = await sender2.send('shared-topic', 'message-for-wire2');

    // Verify responses came from correct wire
    expect(response1.success).toBe(true);
    expect(response1.result).toEqual({ wire: 'wire1', payload: 'message-for-wire1' });

    expect(response2.success).toBe(true);
    expect(response2.result).toEqual({ wire: 'wire2', payload: 'message-for-wire2' });

    // Verify each receiver only processed its own wire's message
    expect(wire1Messages).toEqual(['message-for-wire1']);
    expect(wire2Messages).toEqual(['message-for-wire2']);

    await receiver1.stop();
    await receiver2.stop();
    await sender1.close();
    await sender2.close();
  });

  it('should not allow cross-wire topic subscriptions', async () => {
    // Create two separate Wire instances
    const wire1 = createWire(createMemoryWire('wire1'));
    const wire2 = createWire(createMemoryWire('wire2'));
    wires.push(wire1, wire2);

    // Track broadcasts
    const wire1Broadcasts: any[] = [];
    const wire2Broadcasts: any[] = [];

    // Create receivers and senders
    const receiver1 = wire1.createReceiver(async (_topic, payload) => {
      return { wire: 'wire1', payload };
    });

    const receiver2 = wire2.createReceiver(async (_topic, payload) => {
      return { wire: 'wire2', payload };
    });

    await receiver1.start();
    await receiver2.start();

    const sender1 = wire1.createSender();
    const sender2 = wire2.createSender();

    // Subscribe sender1 to wire1's topic
    await sender1.subscribeTopic('test-topic', broadcast => {
      wire1Broadcasts.push(broadcast);
    });

    // Subscribe sender2 to wire2's topic
    await sender2.subscribeTopic('test-topic', broadcast => {
      wire2Broadcasts.push(broadcast);
    });

    // Send messages on both wires
    await sender1.send('test-topic', 'data1');
    await sender2.send('test-topic', 'data2');

    // Wait for broadcasts to be processed
    await new Promise(resolve => setTimeout(resolve, 100));

    // Each sender should only receive broadcasts from its own wire
    expect(wire1Broadcasts.length).toBe(1);
    expect(wire1Broadcasts[0].response.result.wire).toBe('wire1');

    expect(wire2Broadcasts.length).toBe(1);
    expect(wire2Broadcasts[0].response.result.wire).toBe('wire2');

    await receiver1.stop();
    await receiver2.stop();
    await sender1.close();
    await sender2.close();
  });

  it('should handle multiple wires with the same topic names', async () => {
    // Create three Wire instances
    const wireA = createWire(createMemoryWire('wireA'));
    const wireB = createWire(createMemoryWire('wireB'));
    const wireC = createWire(createMemoryWire('wireC'));
    wires.push(wireA, wireB, wireC);

    // Create receivers on all wires
    const receiverA = wireA.createReceiver(async (topic, payload) => {
      return { wire: 'A', topic, payload };
    });

    const receiverB = wireB.createReceiver(async (topic, payload) => {
      return { wire: 'B', topic, payload };
    });

    const receiverC = wireC.createReceiver(async (topic, payload) => {
      return { wire: 'C', topic, payload };
    });

    await receiverA.start();
    await receiverB.start();
    await receiverC.start();

    // Create senders
    const senderA = wireA.createSender();
    const senderB = wireB.createSender();
    const senderC = wireC.createSender();

    // Send to same topic names on all wires
    const responseA = await senderA.send('orders', 'order-A');
    const responseB = await senderB.send('orders', 'order-B');
    const responseC = await senderC.send('orders', 'order-C');

    // Verify each wire processed only its own message
    expect(responseA.result).toEqual({ wire: 'A', topic: 'orders', payload: 'order-A' });
    expect(responseB.result).toEqual({ wire: 'B', topic: 'orders', payload: 'order-B' });
    expect(responseC.result).toEqual({ wire: 'C', topic: 'orders', payload: 'order-C' });

    // Cleanup
    await receiverA.stop();
    await receiverB.stop();
    await receiverC.stop();
    await senderA.close();
    await senderB.close();
    await senderC.close();
  });

  it('should maintain separate topic ownership per wire', async () => {
    // Create two wires
    const wire1 = createWire(createMemoryWire('wire1'));
    const wire2 = createWire(createMemoryWire('wire2'));
    wires.push(wire1, wire2);

    // Create multiple receivers on each wire
    const receiver1a = wire1.createReceiver(async (_topic, payload) => {
      return { wire: 'wire1', receiver: 'a', payload };
    });

    const receiver1b = wire1.createReceiver(async (_topic, payload) => {
      return { wire: 'wire1', receiver: 'b', payload };
    });

    const receiver2a = wire2.createReceiver(async (_topic, payload) => {
      return { wire: 'wire2', receiver: 'a', payload };
    });

    const receiver2b = wire2.createReceiver(async (_topic, payload) => {
      return { wire: 'wire2', receiver: 'b', payload };
    });

    await receiver1a.start();
    await receiver1b.start();
    await receiver2a.start();
    await receiver2b.start();

    const sender1 = wire1.createSender();
    const sender2 = wire2.createSender();

    // Send multiple messages to same topic on each wire
    const response1_1 = await sender1.send('data-topic', 'msg1');
    const response1_2 = await sender1.send('data-topic', 'msg2');
    const response2_1 = await sender2.send('data-topic', 'msg3');
    const response2_2 = await sender2.send('data-topic', 'msg4');

    // All messages should succeed
    expect(response1_1.success).toBe(true);
    expect(response1_2.success).toBe(true);
    expect(response2_1.success).toBe(true);
    expect(response2_2.success).toBe(true);

    // wire1 messages should be processed by wire1 receivers
    expect((response1_1.result as any).wire).toBe('wire1');
    expect((response1_2.result as any).wire).toBe('wire1');

    // wire2 messages should be processed by wire2 receivers
    expect((response2_1.result as any).wire).toBe('wire2');
    expect((response2_2.result as any).wire).toBe('wire2');

    // Messages on same wire should be handled by same receiver (topic ownership)
    expect((response1_1.result as any).receiver).toBe((response1_2.result as any).receiver);
    expect((response2_1.result as any).receiver).toBe((response2_2.result as any).receiver);

    // Cleanup
    await receiver1a.stop();
    await receiver1b.stop();
    await receiver2a.stop();
    await receiver2b.stop();
    await sender1.close();
    await sender2.close();
  });

  it('should allow default wireId to work alongside custom wireIds', async () => {
    // Create one wire with default ID and one with custom ID
    const defaultWire = createWire(); // Uses 'default'
    const customWire = createWire(createMemoryWire('custom'));
    wires.push(defaultWire, customWire);

    // Create receivers
    const defaultReceiver = defaultWire.createReceiver(async (_topic, payload) => {
      return { wire: 'default', payload };
    });

    const customReceiver = customWire.createReceiver(async (_topic, payload) => {
      return { wire: 'custom', payload };
    });

    await defaultReceiver.start();
    await customReceiver.start();

    const defaultSender = defaultWire.createSender();
    const customSender = customWire.createSender();

    // Send messages
    const defaultResponse = await defaultSender.send('topic', 'default-msg');
    const customResponse = await customSender.send('topic', 'custom-msg');

    // Verify isolation
    expect(defaultResponse.result).toEqual({ wire: 'default', payload: 'default-msg' });
    expect(customResponse.result).toEqual({ wire: 'custom', payload: 'custom-msg' });

    // Cleanup
    await defaultReceiver.stop();
    await customReceiver.stop();
    await defaultSender.close();
    await customSender.close();
  });
});
