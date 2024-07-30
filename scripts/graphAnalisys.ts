import { BlockchainService } from '../src/blockchain/blockchain.service';
import { GraphBuilder } from '../src/blockchain/libs/GraphBuilder';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AnalysisService {
  constructor(private blockchainService: BlockchainService) {}

  async findCommonNodes(addresses: string[]): Promise<string[]> {
    const transactions = await this.blockchainService.getAllInteractions(addresses);

    const graphBuilder = new GraphBuilder();
    graphBuilder.buildGraph(transactions);

    const graph = graphBuilder.getGraph();

    // Поиск общих узлов
    const commonNodes = this.findConnectingNodes(graph, addresses);

    return commonNodes;
  }

  private findConnectingNodes(graph: graphlib.Graph, addresses: string[]): string[] {
    const commonNodes: Set<string> = new Set();

    for (const address of addresses) {
      const neighbors = graph.neighbors(address);
      if (neighbors) {
        neighbors.forEach(neighbor => commonNodes.add(neighbor));
      }
    }

    // Фильтрация узлов, которые не являются исходными адресами
    const result = Array.from(commonNodes).filter(node => !addresses.includes(node));

    return result;
  }
}
