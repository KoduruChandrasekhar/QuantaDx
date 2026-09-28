/** Gate reference (Section 8.2): description, matrix (KaTeX), Bloch effect and QML role. */
import type { GateName } from '@/types/quantum';

export interface GateInfo {
  name: GateName;
  title: string;
  description: string;
  matrix: string;
  bloch: string;
  qml: string;
  params?: number;
  twoQubit?: boolean;
}

export const GATES: GateInfo[] = [
  { name: 'H', title: 'Hadamard', description: 'Creates an equal superposition from a basis state.', matrix: '\\tfrac{1}{\\sqrt2}\\begin{pmatrix}1&1\\\\1&-1\\end{pmatrix}', bloch: 'π rotation about the (x+z)/√2 axis: |0⟩ → |+⟩.', qml: 'Starts the ZZ feature map on every qubit.' },
  { name: 'X', title: 'Pauli-X', description: 'Bit flip.', matrix: '\\begin{pmatrix}0&1\\\\1&0\\end{pmatrix}', bloch: 'π rotation about x: north ↔ south pole.', qml: 'Prepares |1⟩; building block of CNOT.' },
  { name: 'Y', title: 'Pauli-Y', description: 'Bit and phase flip.', matrix: '\\begin{pmatrix}0&-i\\\\i&0\\end{pmatrix}', bloch: 'π rotation about y.', qml: 'Pauli feature maps with Y terms.' },
  { name: 'Z', title: 'Pauli-Z', description: 'Phase flip; the measurement basis.', matrix: '\\begin{pmatrix}1&0\\\\0&-1\\end{pmatrix}', bloch: 'π rotation about z: |+⟩ ↔ |−⟩.', qml: '⟨Z⟩ is the standard read-out for classifiers.' },
  { name: 'S', title: 'S (phase)', description: 'Quarter-turn phase.', matrix: '\\begin{pmatrix}1&0\\\\0&i\\end{pmatrix}', bloch: 'π/2 rotation about z: |+⟩ → |+i⟩.', qml: 'Basis changes for Y measurements.' },
  { name: 'T', title: 'T (π/8)', description: 'Eighth-turn phase.', matrix: '\\begin{pmatrix}1&0\\\\0&e^{i\\pi/4}\\end{pmatrix}', bloch: 'π/4 rotation about z.', qml: 'Universal gate sets (Clifford + T).' },
  { name: 'P', title: 'Phase P(φ)', description: 'Adds phase φ to |1⟩.', matrix: '\\begin{pmatrix}1&0\\\\0&e^{i\\varphi}\\end{pmatrix}', bloch: 'Rotation by φ about z.', qml: 'Encodes data in the ZZ feature map: P(2xᵢ) and P(2(π−xᵢ)(π−xⱼ)).', params: 1 },
  { name: 'RX', title: 'RX(θ)', description: 'Rotation about x.', matrix: '\\begin{pmatrix}\\cos\\frac\\theta2&-i\\sin\\frac\\theta2\\\\-i\\sin\\frac\\theta2&\\cos\\frac\\theta2\\end{pmatrix}', bloch: 'Rotates the arrow by θ around the x-axis.', qml: 'Angle encoding (RX variant); BasicEntanglerLayers.', params: 1 },
  { name: 'RY', title: 'RY(θ)', description: 'Rotation about y — keeps amplitudes real.', matrix: '\\begin{pmatrix}\\cos\\frac\\theta2&-\\sin\\frac\\theta2\\\\\\sin\\frac\\theta2&\\cos\\frac\\theta2\\end{pmatrix}', bloch: 'Tilts the arrow from |0⟩ toward |1⟩ by θ in the x–z plane.', qml: 'Angle encoding; RealAmplitudes ansatz.', params: 1 },
  { name: 'RZ', title: 'RZ(θ)', description: 'Rotation about z.', matrix: '\\begin{pmatrix}e^{-i\\theta/2}&0\\\\0&e^{i\\theta/2}\\end{pmatrix}', bloch: 'Spins the arrow around the z-axis; probabilities unchanged.', qml: 'EfficientSU2; IQP encoding.', params: 1 },
  { name: 'Rot', title: 'Rot(φ, θ, ω)', description: 'General rotation RZ(ω)·RY(θ)·RZ(φ).', matrix: 'R_Z(\\omega)\\,R_Y(\\theta)\\,R_Z(\\varphi)', bloch: 'Any orientation change of the arrow.', qml: 'StronglyEntanglingLayers (PennyLane).', params: 3 },
  { name: 'U3', title: 'U3(θ, φ, λ)', description: 'General single-qubit unitary.', matrix: '\\begin{pmatrix}\\cos\\frac\\theta2&-e^{i\\lambda}\\sin\\frac\\theta2\\\\e^{i\\varphi}\\sin\\frac\\theta2&e^{i(\\varphi+\\lambda)}\\cos\\frac\\theta2\\end{pmatrix}', bloch: 'Any rotation.', qml: 'Hardware-native single-qubit layer.', params: 3 },
  { name: 'CNOT', title: 'CNOT', description: 'Flips the target when the control is |1⟩; creates entanglement.', matrix: '\\begin{pmatrix}1&0&0&0\\\\0&1&0&0\\\\0&0&0&1\\\\0&0&1&0\\end{pmatrix}', bloch: 'H then CNOT: both Bloch vectors shrink to the centre (entangled).', qml: 'Entangling layers of every ansatz; ZZ interaction terms.', twoQubit: true },
  { name: 'CZ', title: 'CZ', description: 'Phase flip on |11⟩.', matrix: '\\mathrm{diag}(1,1,1,-1)', bloch: 'Symmetric entangler.', qml: 'Hardware-efficient entanglers.', twoQubit: true },
  { name: 'SWAP', title: 'SWAP', description: "Exchanges two qubits' states.", matrix: '\\begin{pmatrix}1&0&0&0\\\\0&0&1&0\\\\0&1&0&0\\\\0&0&0&1\\end{pmatrix}', bloch: 'Arrows trade places.', qml: 'Routing on limited-connectivity hardware.', twoQubit: true },
  { name: 'CRZ', title: 'CRZ(θ)', description: 'Controlled RZ.', matrix: '\\mathrm{diag}(1,1,e^{-i\\theta/2},e^{i\\theta/2})', bloch: 'Conditional z-rotation of the target.', qml: 'Trainable entanglers.', params: 1, twoQubit: true },
  { name: 'MEASURE', title: 'Measurement', description: 'Z-basis readout; collapses the state.', matrix: 'P(0)=|\\alpha|^2,\\;P(1)=|\\beta|^2', bloch: 'Projects the arrow onto a pole.', qml: 'Produces ⟨Z⟩ estimates from shots.' },
];

export const gateInfo = (n: GateName) => GATES.find((g) => g.name === n);

/** Gate colours from the deck: H saffron, phase purple, rotations blue, 2-qubit navy, measure green. */
export function gateColor(name: GateName): string {
  if (name === 'H') return 'var(--saffron)';
  if (['P', 'S', 'T', 'Z'].includes(name)) return 'var(--purple)';
  if (['RX', 'RY', 'RZ', 'Rot', 'U3', 'X', 'Y'].includes(name)) return 'var(--blue)';
  if (['CNOT', 'CZ', 'SWAP', 'CRZ'].includes(name)) return 'var(--navy)';
  if (name === 'MEASURE') return 'var(--green)';
  if (name === 'STATEPREP') return 'var(--teal)';
  return 'var(--muted)';
}
