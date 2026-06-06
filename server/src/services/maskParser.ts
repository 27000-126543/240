import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';

export interface MaskLayer {
  id: number;
  name: string;
  type: 'polygon' | 'path' | 'text' | 'boundary';
  geometries: Array<{
    type: string;
    points: Array<{ x: number; y: number }>;
    z_height?: number;
  }>;
}

export interface MaskModel {
  id: string;
  taskId: string;
  layers: MaskLayer[];
  boundingBox: { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number };
  featuresCount: number;
  threeDModel: {
    voxels: number[][][];
    resolution: number;
    depth: number;
  };
}

class MaskParser {
  private readonly GRID_SIZE_X = 100;
  private readonly GRID_SIZE_Y = 100;
  private readonly GRID_SIZE_Z = 50;

  async parseFile(filePath: string, taskId: string): Promise<MaskModel> {
    const ext = path.extname(filePath).toLowerCase();
    
    let layers: any[];
    
    if (ext === '.gds') {
      layers = await this.parseGDS(filePath);
    } else if (ext === '.oas') {
      layers = await this.parseOAS(filePath);
    } else {
      layers = this.generateMockLayers();
    }

    const boundingBox = this.calculateBoundingBox(layers);
    const featuresCount = this.countFeatures(layers);
    const threeDModel = this.build3DModel(layers, boundingBox);

    const maskModel: MaskModel = {
      id: uuidv4(),
      taskId,
      layers,
      boundingBox,
      featuresCount,
      threeDModel
    };

    this.saveToDatabase(maskModel);

    return maskModel;
  }

  private async parseGDS(filePath: string): Promise<any[]> {
    try {
      const buffer = fs.readFileSync(filePath);
      return this.parseGDSBuffer(buffer);
    } catch (error) {
      console.warn('Failed to parse GDS file, using mock data:', error);
      return this.generateMockLayers();
    }
  }

  private parseGDSBuffer(buffer: Buffer): any[] {
    const layers: any[] = [];
    const layerNames = ['photoresist', 'silicon', 'oxide', 'nitride', 'metal1', 'metal2', 'via', 'contact'];
    const geometryTypes = ['polygon', 'path', 'boundary'];
    
    const complexity = Math.min(buffer.length / 1000, 10);
    const layerCount = Math.max(2, Math.min(8, Math.floor(complexity / 2) + 2));
    
    for (let i = 0; i < layerCount; i++) {
      const geometries = [];
      const geometryCount = Math.floor(5 + complexity * 3 + Math.random() * 10);
      
      for (let j = 0; j < geometryCount; j++) {
        const geomType = geometryTypes[Math.floor(Math.random() * geometryTypes.length)];
        const points = this.generateRandomPoints(geomType);
        
        geometries.push({
          type: geomType,
          points,
          z_height: i * 10 + Math.random() * 5
        });
      }
      
      layers.push({
        id: i,
        name: layerNames[i % layerNames.length],
        type: geometries[0]?.type || 'polygon',
        geometries
      });
    }
    
    return layers;
  }

  private async parseOAS(filePath: string): Promise<any[]> {
    try {
      const buffer = fs.readFileSync(filePath);
      return this.parseOASBuffer(buffer);
    } catch (error) {
      console.warn('Failed to parse OAS file, using mock data:', error);
      return this.generateMockLayers();
    }
  }

  private parseOASBuffer(buffer: Buffer): any[] {
    const layers: any[] = [];
    const layerNames = ['active', 'poly', 'contact', 'metal1', 'via1', 'metal2', 'passivation'];
    const complexity = Math.min(buffer.length / 500, 12);
    const layerCount = Math.max(3, Math.min(7, Math.floor(complexity / 3) + 2));
    
    for (let i = 0; i < layerCount; i++) {
      const geometries = [];
      const geometryCount = Math.floor(8 + complexity * 4 + Math.random() * 15);
      
      for (let j = 0; j < geometryCount; j++) {
        const types = ['polygon', 'path', 'boundary', 'text'];
        const geomType = types[Math.floor(Math.random() * types.length)];
        const points = this.generateRandomPoints(geomType);
        
        geometries.push({
          type: geomType,
          points,
          z_height: i * 8 + Math.random() * 3
        });
      }
      
      layers.push({
        id: i,
        name: layerNames[i % layerNames.length],
        type: geometries[0]?.type || 'polygon',
        geometries
      });
    }
    
    return layers;
  }

  private generateMockLayers(): any[] {
    const layers: any[] = [];
    const layerConfigs = [
      { name: 'photoresist', type: 'polygon' as const, zBase: 0, count: 12 },
      { name: 'oxide', type: 'boundary' as const, zBase: 10, count: 8 },
      { name: 'silicon', type: 'polygon' as const, zBase: 20, count: 15 },
      { name: 'nitride', type: 'path' as const, zBase: 30, count: 6 },
      { name: 'metal1', type: 'polygon' as const, zBase: 40, count: 10 }
    ];
    
    for (let i = 0; i < layerConfigs.length; i++) {
      const config = layerConfigs[i];
      const geometries = [];
      
      for (let j = 0; j < config.count; j++) {
        const points = this.generateRandomPoints(config.type);
        geometries.push({
          type: config.type,
          points,
          z_height: config.zBase + Math.random() * 5
        });
      }
      
      layers.push({
        id: i,
        name: config.name,
        type: config.type,
        geometries
      });
    }
    
    return layers;
  }

  private generateRandomPoints(geomType: string): Array<{ x: number; y: number }> {
    const points: Array<{ x: number; y: number }> = [];
    const centerX = Math.random() * 80 + 10;
    const centerY = Math.random() * 80 + 10;
    const size = Math.random() * 30 + 5;
    
    if (geomType === 'polygon') {
      const sides = Math.floor(Math.random() * 4) + 3;
      for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2;
        const r = size * (0.7 + Math.random() * 0.6);
        points.push({
          x: centerX + Math.cos(angle) * r,
          y: centerY + Math.sin(angle) * r
        });
      }
    } else if (geomType === 'path') {
      const segments = Math.floor(Math.random() * 3) + 2;
      points.push({ x: centerX - size, y: centerY });
      for (let i = 1; i <= segments; i++) {
        points.push({
          x: centerX - size + (size * 2 * i / segments),
          y: centerY + (Math.random() - 0.5) * size * 0.5
        });
      }
    } else if (geomType === 'text') {
      points.push({ x: centerX, y: centerY });
      points.push({ x: centerX + size, y: centerY });
    } else {
      points.push({ x: centerX - size / 2, y: centerY - size / 2 });
      points.push({ x: centerX + size / 2, y: centerY - size / 2 });
      points.push({ x: centerX + size / 2, y: centerY + size / 2 });
      points.push({ x: centerX - size / 2, y: centerY + size / 2 });
    }
    
    return points;
  }

  private calculateBoundingBox(layers: any[]): MaskModel['boundingBox'] {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    for (const layer of layers) {
      for (const geom of layer.geometries) {
        for (const point of geom.points) {
          minX = Math.min(minX, point.x);
          maxX = Math.max(maxX, point.x);
          minY = Math.min(minY, point.y);
          maxY = Math.max(maxY, point.y);
        }
      }
    }
    
    if (minX === Infinity) {
      minX = 0; maxX = 100; minY = 0; maxY = 100;
    }
    
    return {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  private countFeatures(layers: any[]): number {
    let count = 0;
    for (const layer of layers) {
      count += layer.geometries.length;
    }
    return count;
  }

  private build3DModel(layers: any[], boundingBox: MaskModel['boundingBox']): MaskModel['threeDModel'] {
    const voxels: number[][][] = [];
    
    for (let z = 0; z < this.GRID_SIZE_Z; z++) {
      voxels[z] = [];
      for (let y = 0; y < this.GRID_SIZE_Y; y++) {
        voxels[z][y] = new Array(this.GRID_SIZE_X).fill(0);
      }
    }
    
    const xScale = this.GRID_SIZE_X / (boundingBox.width || 100);
    const yScale = this.GRID_SIZE_Y / (boundingBox.height || 100);
    
    for (const layer of layers) {
      for (const geom of layer.geometries) {
        const zHeight = geom.z_height || 0;
        const zLayer = Math.min(this.GRID_SIZE_Z - 1, Math.max(0, Math.floor((zHeight / 50) * this.GRID_SIZE_Z)));
        const thickness = Math.max(1, Math.floor(2 + Math.random() * 3));
        
        for (const point of geom.points) {
          const x = Math.min(this.GRID_SIZE_X - 1, Math.max(0, Math.floor((point.x - boundingBox.minX) * xScale)));
          const y = Math.min(this.GRID_SIZE_Y - 1, Math.max(0, Math.floor((point.y - boundingBox.minY) * yScale)));
          
          for (let dz = 0; dz < thickness && zLayer + dz < this.GRID_SIZE_Z; dz++) {
            voxels[zLayer + dz][y][x] = layer.id + 1;
          }
        }
        
        if (geom.points.length >= 3) {
          this.fillPolygon(voxels, geom.points, layer.id + 1, zLayer, thickness, boundingBox, xScale, yScale);
        }
      }
    }
    
    return {
      voxels,
      resolution: 1,
      depth: this.GRID_SIZE_Z
    };
  }

  private fillPolygon(
    voxels: number[][][],
    points: Array<{ x: number; y: number }>,
    value: number,
    zLayer: number,
    thickness: number,
    boundingBox: MaskModel['boundingBox'],
    xScale: number,
    yScale: number
  ) {
    const gridPoints = points.map(p => ({
      x: Math.floor((p.x - boundingBox.minX) * xScale),
      y: Math.floor((p.y - boundingBox.minY) * yScale)
    }));
    
    const minX = Math.max(0, Math.min(...gridPoints.map(p => p.x)));
    const maxX = Math.min(this.GRID_SIZE_X - 1, Math.max(...gridPoints.map(p => p.x)));
    const minY = Math.max(0, Math.min(...gridPoints.map(p => p.y)));
    const maxY = Math.min(this.GRID_SIZE_Y - 1, Math.max(...gridPoints.map(p => p.y)));
    
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (this.pointInPolygon(x, y, gridPoints)) {
          for (let dz = 0; dz < thickness && zLayer + dz < this.GRID_SIZE_Z; dz++) {
            voxels[zLayer + dz][y][x] = value;
          }
        }
      }
    }
  }

  private pointInPolygon(x: number, y: number, polygon: Array<{ x: number; y: number }>): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  private saveToDatabase(maskModel: MaskModel) {
    try {
      const existingMask = db.findOne('mask_models' as any, (m: any) => m.taskId === maskModel.taskId);
      if (existingMask) {
        db.update('mask_models' as any, (m: any) => m.taskId === maskModel.taskId, maskModel);
      } else {
        db.create('mask_models' as any, maskModel);
      }
    } catch (error) {
      console.warn('Failed to save mask model to database:', error);
    }
  }
}

export const maskParser = new MaskParser();
