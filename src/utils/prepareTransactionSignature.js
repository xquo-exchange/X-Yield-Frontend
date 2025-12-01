
import { parseAbi } from "viem";
import { base } from "viem/chains";
import { ethers } from "ethers";


const PERMIT2_ABI = parseAbi([
  "function allowance(address user, address token, address spender) external view returns (uint160 amount, uint48 expiration, uint48 nonce)"
]);
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const GENERAL_ADAPTER1_ADDRESS = "0xb98c948CFA24072e58935BC004a8A7b376AE746A";
const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";


export async function PrepareTransactionSignature(signer, owner, amount) {
    const permit2ContractRead = new ethers.Contract(
        PERMIT2_ADDRESS,
        PERMIT2_ABI,
        signer
    );
    const [, , currentNonce] = await permit2ContractRead.allowance(owner, USDC_ADDRESS, GENERAL_ADAPTER1_ADDRESS);
    const now = Math.floor(Date.now() / 1000);
    // Set deadline to 10 minutes
    const tenMinutes = 10 * 60;
    const deadlineTimestamp = now + tenMinutes;
    const nonce = Number(currentNonce);
    const safeAmount = amount.toString(); 
    const safeDeadline = deadlineTimestamp.toString();
    const expiration = Number(deadlineTimestamp);
    const domain = {
        name: 'Permit2',
        chainId: base.id,
        verifyingContract: PERMIT2_ADDRESS,
    };
    const types = {
        PermitSingle: [
            { name: 'details', type: 'PermitDetails' },
            { name: 'spender', type: 'address' },
            { name: 'sigDeadline', type: 'uint256' }
        ],
        PermitDetails: [
            { name: 'token', type: 'address' },
            { name: 'amount', type: 'uint160' },
            { name: 'expiration', type: 'uint48' },
            { name: 'nonce', type: 'uint48' }
        ]
    };
    const value = {
        details: {
            token: USDC_ADDRESS,
            amount: safeAmount,
            expiration: expiration,
            nonce: nonce,
        },
        spender: GENERAL_ADAPTER1_ADDRESS,
        sigDeadline: safeDeadline,
    };
    const signature = await signer.signTypedData(domain, types, value);
    return {
        'nonce': nonce,
        'expiration': expiration,
        'deadline': safeDeadline,
        'signature': signature
    };
}