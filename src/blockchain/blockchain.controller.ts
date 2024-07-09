import { Controller, Get, Post, Body, Patch, Param, Delete, UsePipes, ValidationPipe } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { BlockchainDto } from './dto/create-blockchain.dto';
import { UpdateBlockchainDto } from './dto/update-blockchain.dto';

@Controller('blockchain')
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  @Get('affiliates/:address')
  async findAffiliates(@Param('address') address: string) {
    return await this.blockchainService.findAffiliates(address);
  }

  @Get('data')
  async getBlockData(){
    return this.blockchainService.getData()
  }

  @Post('data')
  @UsePipes(new ValidationPipe())
  create(@Body() createBlockchainDto: BlockchainDto) {
    return this.blockchainService.create(createBlockchainDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.blockchainService.findOne(+id);
  }

  @Patch(':timestamp')
  update(@Param('timestamp') timestamp: string, @Body() updateBlockchainDto: UpdateBlockchainDto) {
    try {
      return this.blockchainService.update(timestamp, updateBlockchainDto);
    } catch (error) {
      console.error(error); // Лог для отладки
      throw error;
    }
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.blockchainService.remove(+id);
  }
}
