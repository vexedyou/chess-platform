declare module "mqtt/dist/mqtt.min" {
  import type { connect as ConnectFn } from "mqtt";
  export const connect: typeof ConnectFn;
  const mqtt: { connect: typeof ConnectFn };
  export default mqtt;
}
