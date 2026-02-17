export class RequestQueue {
  private lastRequestTime = 0;
  private readonly MIN_INTERVAL = 1000;
  private readonly JITTER_MIN = 500;
  private readonly JITTER_MAX = 1500;

  private getJitter(): number {
    return Math.random() * (this.JITTER_MAX - this.JITTER_MIN) + this.JITTER_MIN;
  }

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const elapsed = Date.now() - this.lastRequestTime;
    const baseWait = Math.max(0, this.MIN_INTERVAL - elapsed);
    const jitter = this.getJitter();
    const waitTime = baseWait + jitter;

    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
    return fn();
  }
}

export const requestQueue = new RequestQueue();
