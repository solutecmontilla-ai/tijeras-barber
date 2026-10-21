// Transporte serial del protocolo The Factory HKA.
// Trama: STX + comando + ETX + LRC, donde LRC = XOR de los bytes del comando y ETX.
// La impresora responde ACK (0x06) si acepta el comando o NAK (0x15) si lo rechaza.
import { SerialPort } from "serialport";

const STX = 0x02;
const ETX = 0x03;
const ENQ = 0x05;
const ACK = 0x06;
const NAK = 0x15;

export function trama(comando) {
  const cuerpo = Buffer.from(comando, "latin1");
  let lrc = 0;
  for (const b of cuerpo) lrc ^= b;
  lrc ^= ETX;
  return Buffer.concat([Buffer.from([STX]), cuerpo, Buffer.from([ETX, lrc])]);
}

export class ImpresoraHKA {
  constructor({ puerto, baudios = 9600, paridad = "even", timeoutMs = 4000, log = () => {} }) {
    this.opts = { path: puerto, baudRate: baudios, dataBits: 8, parity: paridad, stopBits: 1, autoOpen: false };
    this.timeoutMs = timeoutMs;
    this.log = log;
    this.buffer = Buffer.alloc(0);
    this.esperando = null;
  }

  abrir() {
    this.port = new SerialPort(this.opts);
    this.port.on("data", (d) => {
      this.buffer = Buffer.concat([this.buffer, d]);
      this.esperando?.();
    });
    return new Promise((ok, mal) => this.port.open((e) => (e ? mal(e) : ok())));
  }

  cerrar() {
    return new Promise((ok) => (this.port?.isOpen ? this.port.close(() => ok()) : ok()));
  }

  // Espera hasta que `listo(buffer)` devuelva un valor distinto de undefined
  esperar(listo, timeoutMs) {
    return new Promise((ok, mal) => {
      const revisar = () => {
        const r = listo(this.buffer);
        if (r !== undefined) {
          clearTimeout(t);
          this.esperando = null;
          if (r instanceof Error) mal(r);
          else ok(r);
        }
      };
      const t = setTimeout(() => {
        this.esperando = null;
        mal(new Error("La impresora no respondio (timeout)"));
      }, timeoutMs);
      this.esperando = revisar;
      revisar();
    });
  }

  escribir(buf) {
    return new Promise((ok, mal) => this.port.write(buf, (e) => (e ? mal(e) : this.port.drain(() => ok()))));
  }

  // Envia un comando y espera ACK/NAK
  async enviar(comando, timeoutMs = this.timeoutMs) {
    this.buffer = Buffer.alloc(0);
    this.log(`> ${comando}`);
    await this.escribir(trama(comando));
    const r = await this.esperar((b) => {
      if (b.includes(ACK)) return true;
      if (b.includes(NAK)) return false;
      return undefined;
    }, timeoutMs);
    if (!r) throw new Error(`Impresora rechazo el comando (NAK): ${comando}`);
  }

  // Envia un comando que devuelve datos (p. ej. S1) y retorna el contenido entre STX y ETX
  async consultar(comando, timeoutMs = this.timeoutMs) {
    this.buffer = Buffer.alloc(0);
    this.log(`? ${comando}`);
    await this.escribir(trama(comando));
    return this.esperar((b) => {
      if (b.length === 1 && b[0] === NAK) return new Error(`NAK en consulta ${comando}`);
      const i = b.indexOf(STX);
      const j = b.indexOf(ETX, i + 1);
      if (i >= 0 && j > i && b.length > j + 1) return b.subarray(i + 1, j).toString("latin1");
      return undefined;
    }, timeoutMs);
  }

  // Estado rapido (ENQ): devuelve los bytes de status/error de la impresora
  async estado() {
    this.buffer = Buffer.alloc(0);
    await this.escribir(Buffer.from([ENQ]));
    return this.esperar((b) => {
      const i = b.indexOf(STX);
      const j = b.indexOf(ETX, i + 1);
      if (i >= 0 && j > i) return { status: b[i + 1], error: b[i + 2] };
      return undefined;
    }, this.timeoutMs);
  }
}
