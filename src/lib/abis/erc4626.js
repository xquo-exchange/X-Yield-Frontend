export const erc4626Abi = [
  { "type":"function","name":"deposit","stateMutability":"nonpayable","inputs":[{"name":"assets","type":"uint256"},{"name":"receiver","type":"address"}],"outputs":[{"name":"shares","type":"uint256"}]},
  { "type":"function","name":"withdraw","stateMutability":"nonpayable","inputs":[{"name":"assets","type":"uint256"},{"name":"receiver","type":"address"},{"name":"owner","type":"address"}],"outputs":[{"name":"shares","type":"uint256"}]},
  { "type":"function","name":"balanceOf","stateMutability":"view","inputs":[{"name":"a","type":"address"}],"outputs":[{"type":"uint256"}]},
  { "type":"function","name":"previewDeposit","stateMutability":"view","inputs":[{"name":"assets","type":"uint256"}],"outputs":[{"type":"uint256"}]},
  { "type":"function","name":"previewWithdraw","stateMutability":"view","inputs":[{"name":"assets","type":"uint256"}],"outputs":[{"type":"uint256"}]},
  { "type":"function","name":"previewRedeem","stateMutability":"view","inputs":[{"name":"shares","type":"uint256"}],"outputs":[{"type":"uint256"}]},
  { "type":"function","name":"maxWithdraw","stateMutability":"view","inputs":[{"name":"owner","type":"address"}],"outputs":[{"type":"uint256"}]}
];
