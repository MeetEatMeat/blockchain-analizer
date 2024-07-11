import checkAffiliates from './analize';

import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainService } from '../blockchain.service';
import { PrismaService } from '../../prisma.service';

async function main() {
  // Создаем тестовый модуль
  const module: TestingModule = await Test.createTestingModule({
    providers: [BlockchainService, PrismaService],
  }).compile();

  // Получаем экземпляр сервиса
  const blockchainService = module.get<BlockchainService>(BlockchainService);
  const prismaService = module.get<PrismaService>(PrismaService);

  // Адрес для анализа
  const address = '0xb81d70802a816b5dacba06d708b5acf19dcd436d';

  // Вызываем метод findAffiliates
  const result = await blockchainService.findAffiliates(address, 10);

  // Выводим результат
  console.log(result);

  // Завершаем подключение к базе данных
  await prismaService.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});


// const address = '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984'; // Uniswap Uni token
// const address = '0xb81d70802a816b5dacba06d708b5acf19dcd436d'; // Dextoken
// const address = '0xba12222222228d8ba445958a75a0704d566bf2c8'; // Balancer vault
