import { Controller, Get, Post, Body, Patch, Param, Delete, UsePipes, ValidationPipe, ParseIntPipe } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';

@Controller('blockchain')
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  @Get('analysis/labels/:address')
  async findLabels(
    @Param('address') address: string
  ){
    return await this.blockchainService.getLabels(address);
  }

  @Get('analysis/affiliates/:address/:range')
  async findAffiliates(
    @Param('address') address: string, 
    @Param('range', ParseIntPipe) range: number
  ){
    return await this.blockchainService.findAffiliates(address, range);
  }

  @Get('analysis/transactions')
  async getTransactionCount() {
    return await this.blockchainService.getTransactionsCount();
  }

  @Get('analysis/token-transfers')
  async getTokenTransferCount() {
    return await this.blockchainService.getTokenTransferCount();
  }

  @Get('analysis/relations/target/:address/:target')
  async checkTokenTransferRelations(
    @Param('address') address: string, 
    @Param('target') target: string
  ) {
    return await this.blockchainService.collectExactAddressTransfers(address.toLowerCase(), target.toLowerCase());
  }

  @Get('analysis/relations/address/:address')
  async findERC20TransfersFromAddress(
    @Param('address') address: string
  ) {
    return await this.blockchainService.collectAllContrparties('', address.toLowerCase());
  }

  @Get('analysis/relations/token/:contractaddress')
  async findERC20TransfersFromContract(
    @Param('contractaddress') contractaddress: string
  ) {
    return await this.blockchainService.collectAllContrparties(contractaddress.toLowerCase(), '');
  }

  @Get('analysis/relations/token-address/:tokenaddress/:address')
  async findTokenTransfersFromAddress(
    @Param('tokenaddress') tokenaddress: string, 
    @Param('address') address: string
  ) {
    console.log("Token address: ", tokenaddress);
    console.log("Address: ", address);
    return await this.blockchainService.collectAllContrparties(tokenaddress.toLowerCase(), address.toLowerCase());
  }

}
