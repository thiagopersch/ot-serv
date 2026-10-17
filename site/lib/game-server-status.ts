import net from "node:net";

const PROBE_TIMEOUT_MS = 1500;

/**
 * O OTServer (TheForgottenServer) não expõe um endpoint HTTP de status — só as portas de
 * login/game (ver config.lua `loginPort`/`gamePort`). Como só precisamos saber se o processo
 * está de pé (não o conteúdo do protocolo OT), um connect TCP cru na porta de login é
 * suficiente: conectou = processo escutando; recusado/timeout = servidor desligado.
 */
export function isGameServerOnline(): Promise<boolean> {
  const host = process.env.GAME_SERVER_HOST || "127.0.0.1";
  const port = Number(process.env.GAME_SERVER_LOGIN_PORT) || 7171;

  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: PROBE_TIMEOUT_MS });

    function finish(online: boolean) {
      socket.destroy();
      resolve(online);
    }

    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}
