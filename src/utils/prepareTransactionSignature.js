
import { parseAbi } from "viem";
import { base } from "viem/chains";
import { ethers } from "ethers";

const eip712Abi = parseAbi([
  "function nonces(address owner) view returns (uint256)",
  // Aggiungo anche name e version perché servono per il Domain
  "function name() view returns (string)",
  "function version() view returns (string)", 
  // Alcuni token usano "EIP712Domain" per la versione, ma proviamo lo standard
]);
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const GENERAL_ADAPTER1_ADDRESS = "0xb98c948CFA24072e58935BC004a8A7b376AE746A";
const VAULT_ADDRESS = "0x1440D8BE4003BE42005d7E25f15B01f1635F7640";


export async function PrepareDepositTransactionSignature(signer, owner, amount) {
    const usdcContract = new ethers.Contract(
        USDC_ADDRESS,
        eip712Abi,
        signer
    );
    const currentNonce = await usdcContract.nonces(owner)
    const tenMinutes = 10 * 60;
    const now = Math.floor(Date.now() / 1000);
    const deadlineTimestamp = BigInt(now + tenMinutes);
    const messageForSigning = {
        owner: owner,      
        spender: GENERAL_ADAPTER1_ADDRESS,    
        value: amount,       
        nonce: currentNonce,                
        deadline: deadlineTimestamp,
    };
    const tokenName = await usdcContract.name()
    const domain = {
      name: tokenName,          
      version: "2",               
      chainId: base.id,
      verifyingContract: USDC_ADDRESS,
    }
    const types = {
      // Struttura standard EIP-2612
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' }
      ]
    }
    const value = messageForSigning
    const signature = await signer.signTypedData(domain, types, value);
    return {
        'nonce': currentNonce.toString(),
        'deadline': deadlineTimestamp.toString(),
        'signature': signature
    };
}

export async function PrepareWithdrawalTransactionSignature(signer, owner, amount) {
    const vaultContract = new ethers.Contract(
        VAULT_ADDRESS,
        eip712Abi,
        signer
    );
    const currentNonce = await vaultContract.nonces(owner)
    const tenMinutes = 10 * 60;
    const now = Math.floor(Date.now() / 1000);
    const deadlineTimestamp = BigInt(now + tenMinutes);
    const messageForSigning = {
        owner: owner,      
        spender: GENERAL_ADAPTER1_ADDRESS,    
        value: amount,       
        nonce: currentNonce,                
        deadline: deadlineTimestamp,
    };
    const domain = {
      name: "",          
      version: "1",               
      chainId: base.id,
      verifyingContract: VAULT_ADDRESS,
    }
    const types = {
      // Struttura standard EIP-2612
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' }
      ]
    }
    const value = messageForSigning
    const signature = await signer.signTypedData(domain, types, value);
    return {
        'nonce': currentNonce.toString(),
        'deadline': deadlineTimestamp.toString(),
        'signature': signature
    };
}