/** Limites de tamanho para upload dos arquivos crus do cliente (`Tibia.dat`/`Tibia.spr`) —
 * bem maiores que `MAX_OBD_BYTES`/`MAX_IMAGE_BYTES` (pensados para 1 sprite por arquivo), já que
 * aqui é o cliente inteiro de uma vez. Um `.spr` de cliente "vanilla" teria dezenas de MB, mas um
 * servidor com conteúdo customizado extenso pode passar de 1GB — o `Tibia.spr` real deste
 * projeto (~1 milhão de sprites) tem ~1,28GB (1.340.441.967 bytes), então o teto precisa de folga
 * bem maior que isso.
 *
 * Nota operacional: se houver proxy reverso (nginx/Caddy) na frente do Next em produção, seu
 * limite de tamanho de corpo de requisição (ex. `client_max_body_size`) precisa ser ajustado para
 * >= MAX_SPR_BYTES + margem, senão o upload do `.spr` é rejeitado antes de chegar no Next — isso
 * não é algo que o código da aplicação resolve sozinho. */
export const MAX_DAT_BYTES = 20 * 1024 * 1024;
export const MAX_SPR_BYTES = 2 * 1024 * 1024 * 1024;
