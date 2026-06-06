import { ProcessParams } from '../types';

export interface PlasmaState {
  ionDensity: number;
  electronTemp: number;
  ionEnergy: number;
  neutralPressure: number;
  radicalDensity: {
    Ar: number;
    CF4: number;
    O2: number;
    F: number;
    CFx: number;
  };
}

export interface EtchMetrics {
  etchRate: number;
  profileAngle: number;
  selectivity: number;
  uniformity: number;
  roughness: number;
}

const k_B = 1.380649e-23;
const eV_TO_J = 1.602176634e-19;
const kT_eV = 0.0259;

class PhysicsEngine {
  private readonly k = 1.38e-23;
  private readonly e = 1.602e-19;
  private readonly m_Ar = 6.63e-26;

  calculatePlasmaState(params: ProcessParams): PlasmaState {
    const rf_power = Math.max(10, params.rf_power);
    const pressure = Math.max(0.1, params.pressure);
    const bias_power = Math.max(0, params.bias_power);
    const gas_ratio = params.gas_ratio;
    const totalGas = gas_ratio.Ar + gas_ratio.CF4 + gas_ratio.O2;

    const ionDensity = 1e10 * Math.pow(rf_power / 500, 0.7) * Math.pow(1 / pressure, 0.3);

    const electronTemp = 2 + 3 * Math.pow(500 / rf_power, 0.3) * Math.pow(pressure / 10, 0.2);

    const ionEnergy = 10 + 100 * Math.pow(bias_power / 500, 0.8) + 2 * electronTemp;

    const totalRatio = totalGas || 1;
    const Ar_frac = gas_ratio.Ar / totalRatio;
    const CF4_frac = gas_ratio.CF4 / totalRatio;
    const O2_frac = gas_ratio.O2 / totalRatio;

    const n0 = 3.2e16 * pressure;
    const dissociation_efficiency = 0.1 + 0.3 * Math.pow(rf_power / 1000, 0.5);

    const radicalDensity = {
      Ar: n0 * Ar_frac,
      CF4: n0 * CF4_frac * (1 - dissociation_efficiency),
      O2: n0 * O2_frac * (1 - dissociation_efficiency * 0.5),
      F: n0 * CF4_frac * dissociation_efficiency * 2,
      CFx: n0 * CF4_frac * dissociation_efficiency * 0.8
    };

    return {
      ionDensity,
      electronTemp,
      ionEnergy,
      neutralPressure: pressure,
      radicalDensity
    };
  }

  calculateEtchRate(plasma: PlasmaState, params: ProcessParams): number {
    const kT = kT_eV;
    const Ea = 0.2;

    const sputterYield = 0.1 + 0.01 * Math.pow(plasma.ionEnergy / 100, 1.5);
    const sputterRate = sputterYield * plasma.ionDensity * 1e-14;

    const F_density = plasma.radicalDensity.F;
    const chemicalRate = F_density * 1e-16 * Math.exp(-Ea / kT);

    const totalRate_nm_s = (sputterRate + chemicalRate) * 1e7;

    const etchRate = totalRate_nm_s * 60;

    return Math.max(10, Math.min(500, etchRate));
  }

  calculateProfileAngle(plasma: PlasmaState, params: ProcessParams): number {
    const pressure = plasma.neutralPressure;
    const bias_power = params.bias_power;
    const ionEnergy = plasma.ionEnergy;

    const meanFreePath = 10 / pressure;
    const collimationFactor = 1 / (1 + 1 / (meanFreePath * 0.1));

    const verticalEtch = this.calculateEtchRate(plasma, params);

    const pressureFactor = Math.pow(pressure / 50, 0.4);
    const biasFactor = Math.pow(bias_power / 500, -0.3);
    const lateralEtch = verticalEtch * 0.1 * pressureFactor * (1 + biasFactor * 0.5);

    const baseAngle = 90 - Math.atan(lateralEtch / verticalEtch) * (180 / Math.PI);

    const ionAngularSpread = 5 + 15 * pressureFactor * (1 - collimationFactor);

    const profileAngle = baseAngle - ionAngularSpread * 0.3;

    return Math.max(60, Math.min(90, profileAngle));
  }

  calculateSelectivity(plasma: PlasmaState, params: ProcessParams): number {
    const cf4Ratio = params.gas_ratio.CF4 / (params.gas_ratio.Ar + params.gas_ratio.CF4 + params.gas_ratio.O2 || 1);
    const biasFactor = Math.pow(params.bias_power / 500, 0.5);
    const pressureFactor = Math.pow(params.pressure / 50, 0.3);

    const siliconRate = this.calculateEtchRate(plasma, params);

    const maskParams: ProcessParams = {
      ...params,
      bias_power: params.bias_power * 0.7
    };
    const maskPlasma = this.calculatePlasmaState(maskParams);
    const maskSputterYield = 0.05 + 0.005 * Math.pow(maskPlasma.ionEnergy / 100, 1.5);
    const maskSputterRate = maskSputterYield * maskPlasma.ionDensity * 1e-14 * 1e7 * 60;

    const cf4Effect = 1 - 0.5 * cf4Ratio;
    const biasEffect = 1 - 0.3 * biasFactor;
    const pressureEffect = 1 + 0.2 * pressureFactor;

    const maskRate = maskSputterRate * cf4Effect * biasEffect * pressureEffect;

    const selectivity = siliconRate / Math.max(maskRate, 1);

    return Math.max(2, Math.min(50, selectivity));
  }

  calculateUniformity(plasma: PlasmaState, params: ProcessParams): number {
    const rf_power = params.rf_power;
    const pressure = params.pressure;

    const rfUniformity = 90 + 8 * Math.pow(rf_power / 1000, 0.3);
    const pressureUniformity = 95 - 10 * Math.pow(pressure / 100, 0.5);

    const baseUniformity = (rfUniformity + pressureUniformity) / 2;

    const gasUniformity = 92 + 5 * (params.gas_ratio.Ar / 100);

    const uniformity = (baseUniformity * 0.7 + gasUniformity * 0.3);

    return Math.max(80, Math.min(99.9, uniformity));
  }

  calculateRoughness(plasma: PlasmaState, params: ProcessParams, time: number): number {
    const Ra0 = 0.5;
    const Rmax = 5 + 3 * Math.pow(plasma.ionEnergy / 200, 0.8);
    const tau = 60 + 120 * Math.pow(params.pressure / 50, 0.5);

    const roughness = Ra0 + (1 - Math.exp(-time / tau)) * Rmax;

    const energyFluctuation = 0.2 * Math.sin(time / 10) * Math.pow(plasma.ionEnergy / 100, 0.3);

    return Math.max(0.3, roughness + energyFluctuation);
  }

  calculateAllMetrics(
    params: ProcessParams,
    progress: number,
    timeElapsed: number
  ): {
    etchRate: number;
    profileAngle: number;
    selectivity: number;
    uniformity: number;
    roughness: number;
    etchDepth: number;
  } {
    const plasma = this.calculatePlasmaState(params);

    const etchRate = this.calculateEtchRate(plasma, params);
    const profileAngle = this.calculateProfileAngle(plasma, params);
    const selectivity = this.calculateSelectivity(plasma, params);
    const uniformity = this.calculateUniformity(plasma, params);
    const roughness = this.calculateRoughness(plasma, params, timeElapsed);

    const etchDepth = etchRate * (timeElapsed / 60) * (progress / 100);

    return {
      etchRate: Number(etchRate.toFixed(2)),
      profileAngle: Number(profileAngle.toFixed(2)),
      selectivity: Number(selectivity.toFixed(2)),
      uniformity: Number(uniformity.toFixed(2)),
      roughness: Number(roughness.toFixed(3)),
      etchDepth: Number(etchDepth.toFixed(2))
    };
  }

  generateRateDistribution(params: ProcessParams, width: number): number[] {
    const plasma = this.calculatePlasmaState(params);
    const baseRate = this.calculateEtchRate(plasma, params);
    const uniformity = this.calculateUniformity(plasma, params);

    const maxDeviation = (100 - uniformity) / 100 * baseRate;
    const center = width / 2;

    return Array.from({ length: width }, (_, i) => {
      const distance = Math.abs(i - center) / center;
      const edgeEffect = distance * distance * 0.5;
      const centerBoost = (1 - distance * distance) * 0.2;

      const rate = baseRate * (1 - edgeEffect + centerBoost);
      const noise = (Math.random() - 0.5) * maxDeviation * 0.2;

      return Number((rate + noise).toFixed(2));
    });
  }

  generateRoughnessCurve(params: ProcessParams, time: number, points: number): number[] {
    const plasma = this.calculatePlasmaState(params);
    const curve: number[] = [];

    for (let i = 0; i < points; i++) {
      const t = (i / points) * time;
      const baseRoughness = this.calculateRoughness(plasma, params, t);

      const highFreq = Math.sin(t * 0.5) * 0.2;
      const lowFreq = Math.sin(t * 0.1) * 0.3;
      const noise = (Math.random() - 0.5) * 0.15;

      curve.push(Number((baseRoughness + highFreq + lowFreq + noise).toFixed(3)));
    }

    return curve;
  }

  generateProfileCoords(
    params: ProcessParams,
    etchDepth: number,
    points: number
  ): Array<{ x: number; y: number }> {
    const plasma = this.calculatePlasmaState(params);
    const angle = this.calculateProfileAngle(plasma, params);
    const angleRad = angle * Math.PI / 180;

    const coords: Array<{ x: number; y: number }> = [];
    const featureWidth = 50;

    for (let i = 0; i < points; i++) {
      const depthFactor = i / (points - 1);
      const currentDepth = depthFactor * etchDepth;

      const sidewallOffset = currentDepth / Math.tan(angleRad);
      const x = featureWidth / 2 + sidewallOffset;
      const y = currentDepth;

      const roughness = 0.5 + Math.sin(i * 0.3) * 0.3 + Math.random() * 0.2;

      coords.push({
        x: Number(x.toFixed(2)),
        y: Number((y + roughness * 0.5).toFixed(2))
      });
    }

    return coords;
  }
}

export const physicsEngine = new PhysicsEngine();
