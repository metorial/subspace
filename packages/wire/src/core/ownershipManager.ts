import type { ICoordinationAdapter } from '../adapters/coordination/coordinationAdapter';

export class OwnershipManager {
  private ownedTopics: Set<string> = new Set();
  private renewalInterval: Timer | null = null;

  constructor(
    private receiverId: string,
    private coordination: ICoordinationAdapter,
    private renewalIntervalMs: number,
    private ownershipTtl: number
  ) {}

  start(): void {
    if (this.renewalInterval) {
      return;
    }

    this.renewalInterval = setInterval(() => {
      this.renewOwnerships().catch(err => {
        console.error('Error renewing ownerships:', err);
      });
    }, this.renewalIntervalMs);
  }

  stop(): void {
    if (this.renewalInterval) {
      clearInterval(this.renewalInterval);
      this.renewalInterval = null;
    }
  }

  addTopic(topic: string): void {
    this.ownedTopics.add(topic);
  }

  removeTopic(topic: string): void {
    this.ownedTopics.delete(topic);
  }

  ownsTopic(topic: string): boolean {
    return this.ownedTopics.has(topic);
  }

  getOwnedTopics(): string[] {
    return Array.from(this.ownedTopics);
  }

  async releaseAll(): Promise<void> {
    let releases = Array.from(this.ownedTopics).map(topic =>
      this.coordination.releaseTopicOwnership(topic, this.receiverId).catch(err => {
        console.error(`Error releasing ownership of ${topic}:`, err);
      })
    );

    await Promise.all(releases);
    this.ownedTopics.clear();
  }

  private async renewOwnerships(): Promise<void> {
    let renewals = Array.from(this.ownedTopics).map(async topic => {
      try {
        let renewed = await this.coordination.renewTopicOwnership(
          topic,
          this.receiverId,
          this.ownershipTtl
        );

        // If renewal failed, we lost ownership
        if (!renewed) {
          console.warn(`Lost ownership of topic ${topic}, removing from owned set`);
          this.ownedTopics.delete(topic);
        }
      } catch (err) {
        console.error(`Error renewing ownership of ${topic}:`, err);
        // Don't remove from set on error - might be transient
      }
    });

    await Promise.all(renewals);
  }

  getOwnedCount(): number {
    return this.ownedTopics.size;
  }
}
