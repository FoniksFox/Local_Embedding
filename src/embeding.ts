import { UMAP } from 'umap-js';

export interface EmbeddingNode {
    id: string;
    vector: number[];
}

export function generateNodes(count: number, dimension: number): EmbeddingNode[] {
    const nodes: EmbeddingNode[] = [];
    for (let i = 0; i < count; i++) {
        const node: EmbeddingNode = {
            id: `node-${i}`,
            vector: Array.from({ length: dimension }, () => Math.random() * 2 - 1)
        };
        nodes.push(node);
    }
    return nodes;
}

export function getNearestNeighbors(nodes: EmbeddingNode[], queryNode: EmbeddingNode, k: number): EmbeddingNode[] {
    const distances = nodes.map(node => {
        const dist = Math.sqrt(node.vector.reduce((sum: number, val: number, idx: number) => sum + (val - queryNode.vector[idx]) ** 2, 0));
        if (node.id === queryNode.id) return { node, dist: Infinity }; // Exclude self
        return { node, dist };
    });
    distances.sort((a, b) => a.dist - b.dist);
    return distances.slice(0, k).map(d => d.node);
}

export async function getLocalEmbedding(nodes: EmbeddingNode[], queryNode: EmbeddingNode, k: number): Promise<number[][]> {
    const neighbors = getNearestNeighbors(nodes, queryNode, k);
    const umap = new UMAP();
    const embedding = await umap.fitAsync(neighbors.map(n => n.vector), epochNumber => {
        console.log(`UMAP epoch ${epochNumber}`);
    });
    return embedding;
}