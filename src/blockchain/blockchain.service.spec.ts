import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainService } from './blockchain.service';
import { PrismaService } from '../prisma.service';

describe('BlockchainService', () => {
  let service: BlockchainService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BlockchainService, PrismaService],
    }).compile();

    service = module.get<BlockchainService>(BlockchainService);
    prisma = module.get<PrismaService>(PrismaService);

    prisma.transaction.create = jest.fn().mockImplementation((data) => {
      return data;
    });
    prisma.transaction.findMany = jest.fn().mockImplementation((data) => {
      return data;
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should fetch affiliates and save transactions', async () => {
    const address = '0xExampleAddress';
    const transactions = await service.findAffiliates(address);
    
    expect(transactions).toBeDefined();
    expect(prisma.transaction.create).toHaveBeenCalled();
    expect(prisma.transaction.findMany).toHaveBeenCalled();
  });
});
