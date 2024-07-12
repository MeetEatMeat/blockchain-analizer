import { Controller, Get, Post, Body, Patch, Param, Delete, UsePipes, ValidationPipe } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { BlockchainDto } from './dto/create-blockchain.dto';
import { UpdateBlockchainDto } from './dto/update-blockchain.dto';

@Controller('blockchain')
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  @Get('affiliates/:address/:range')
  async findAffiliates(@Param('address') address: string, @Param('range') range: number){
    return await this.blockchainService.findAffiliates(address, range);
  }

  @Post('transactions/all-in-out/:address')
  async addNewAddress(@Param('address') address: string) {
    return await this.blockchainService.uploadAddressTransactions(address);
  }

  @Post('erc20transfers/from-address/:address')
  async findERC20TransfersFromAddress(@Param('contractaddress') contractaddress: string, @Param('address') address: string) {
    return await this.blockchainService.findERC20TransfersFromAddress(address);
  }

  @Post('erc20transfers/from-contract/:contractaddress')
  async findERC20TransfersFromContract(@Param('contractaddress') contractaddress: string) {
    return await this.blockchainService.findERC20TransfersFromContract(contractaddress);
  }

  @Post('erc20transfers/token-from-address/:tokenaddress/:address')
  async findTokenTransfersFromAddress(@Param('tokenaddress') tokenaddress: string, @Param('address') address: string) {
    return await this.blockchainService.findTokenTransfersFromAddress(tokenaddress, address);
  }

}
