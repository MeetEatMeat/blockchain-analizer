import checkAffiliates from './analize';

// const address = '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984'; // Uniswap Uni token
const address = '0xb81d70802a816b5dacba06d708b5acf19dcd436d'; // Dextoken

checkAffiliates(address).catch(console.error); 