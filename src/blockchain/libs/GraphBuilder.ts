import * as graphlib from 'graphlib';
import { ITransaction } from '../dto/interactions.dto';

interface TransactionNode {
  address: string;
  transactions: ITransaction[];
}

class GraphBuilder {
  private graph: graphlib.Graph;

  constructor() {
    this.graph = new graphlib.Graph({ directed: false });
  }

  addTransaction(transaction: ITransaction) {
    if (!this.graph.hasNode(transaction.from)) {
      this.graph.setNode(transaction.from);
    }

    if (!this.graph.hasNode(transaction.to)) {
      this.graph.setNode(transaction.to);
    }

    this.graph.setEdge(transaction.from, transaction.to);
  }

  buildGraph(transactions: ITransaction[]) {
    transactions.forEach(transaction => this.addTransaction(transaction));
  }

  getGraph(): graphlib.Graph {
    return this.graph;
  }
}

export { GraphBuilder, TransactionNode, ITransaction };