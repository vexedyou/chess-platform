/**
 * Minimal MQTT 3.1.1 client over WebSocket (browser-only).
 * Avoids the mqtt npm package which breaks under Turbopack/Next.
 */

type Handler = (topic: string, payload: string) => void;

function encodeString(s: string): number[] {
  const enc = new TextEncoder().encode(s);
  return [enc.length >> 8, enc.length & 0xff, ...enc];
}

function encodeLength(len: number): number[] {
  const out: number[] = [];
  do {
    let byte = len % 128;
    len = Math.floor(len / 128);
    if (len > 0) byte |= 0x80;
    out.push(byte);
  } while (len > 0);
  return out;
}

export class MiniMqtt {
  private ws: WebSocket | null = null;
  private onMessage: Handler | null = null;
  private intentionalClose = false;
  connected = false;

  constructor(
    private url: string,
    private clientId: string
  ) {}

  connect(timeoutMs = 8000): Promise<void> {
    this.intentionalClose = false;
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try {
          this.ws?.close();
        } catch {
          /* */
        }
        reject(new Error("timeout"));
      }, timeoutMs);

      try {
        this.ws = new WebSocket(this.url, ["mqtt"]);
      } catch (e) {
        clearTimeout(timer);
        reject(e);
        return;
      }

      this.ws.binaryType = "arraybuffer";

      this.ws.onopen = () => {
        // MQTT CONNECT
        const proto = encodeString("MQTT");
        const cid = encodeString(this.clientId);
        const variable = [
          ...proto,
          0x04, // protocol level 4 (3.1.1)
          0x02, // clean session
          0x00,
          0x3c, // keep alive 60s
          ...cid,
        ];
        const packet = [0x10, ...encodeLength(variable.length), ...variable];
        this.ws!.send(new Uint8Array(packet));
      };

      this.ws.onmessage = (ev) => {
        const data = new Uint8Array(ev.data as ArrayBuffer);
        if (!data.length) return;
        const type = data[0] >> 4;

        // CONNACK
        if (type === 2) {
          const code = data[3] ?? 1;
          if (code === 0) {
            this.connected = true;
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              resolve();
            }
          } else if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(new Error("connack " + code));
          }
          return;
        }

        // PUBLISH
        if (type === 3) {
          let i = 1;
          // skip remaining length
          while (i < data.length && data[i] & 0x80) i++;
          i++;
          if (i + 2 > data.length) return;
          const topicLen = (data[i] << 8) | data[i + 1];
          i += 2;
          if (i + topicLen > data.length) return;
          const topic = new TextDecoder().decode(data.slice(i, i + topicLen));
          i += topicLen;
          // qos 0 assumed — no packet id
          const payload = new TextDecoder().decode(data.slice(i));
          this.onMessage?.(topic, payload);
        }

        // PINGRESP (13) — ignore
      };

      this.ws.onerror = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error("ws error"));
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error("ws closed"));
        }
      };
    });
  }

  subscribe(topic: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const t = encodeString(topic);
    const variable = [...t, 0x00]; // QoS 0
    const packet = [0x82, ...encodeLength(variable.length), ...variable];
    this.ws.send(new Uint8Array(packet));
  }

  publish(topic: string, message: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const t = encodeString(topic);
    const payload = [...new TextEncoder().encode(message)];
    const variable = [...t, ...payload];
    const packet = [0x30, ...encodeLength(variable.length), ...variable]; // PUBLISH qos0
    this.ws.send(new Uint8Array(packet));
  }

  on(handler: Handler) {
    this.onMessage = handler;
  }

  end() {
    this.intentionalClose = true;
    this.connected = false;
    try {
      this.ws?.close();
    } catch {
      /* */
    }
    this.ws = null;
  }
}

export const MQTT_URLS = [
  "wss://broker.emqx.io:8084/mqtt",
  "wss://test.mosquitto.org:8081/mqtt",
  "wss://broker.hivemq.com:8884/mqtt",
];
