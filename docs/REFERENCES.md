# References

Numbering matches the Smart India Hackathon 2026 submission deck and the README.

1. Biamonte et al., "Quantum machine learning," *Nature* 549 (2017). DOI: [10.1038/nature23474](https://doi.org/10.1038/nature23474)
2. Preskill, "Quantum computing in the NISQ era and beyond," *Quantum* 2, 79 (2018). DOI: [10.22331/q-2018-08-06-79](https://doi.org/10.22331/q-2018-08-06-79)
3. Havlíček et al., "Supervised learning with quantum-enhanced feature spaces," *Nature* 567 (2019). DOI: [10.1038/s41586-019-0980-2](https://doi.org/10.1038/s41586-019-0980-2)
4. Schuld & Killoran, "Quantum machine learning in feature Hilbert spaces," *Phys. Rev. Lett.* 122 (2019). DOI: [10.1103/PhysRevLett.122.040504](https://doi.org/10.1103/PhysRevLett.122.040504)
5. McClean et al., "Barren plateaus in quantum neural network training landscapes," *Nat. Commun.* 9 (2018). DOI: [10.1038/s41467-018-07090-4](https://doi.org/10.1038/s41467-018-07090-4)
6. Schuld et al., "Circuit-centric quantum classifiers," *Phys. Rev. A* 101 (2020). DOI: [10.1103/PhysRevA.101.032308](https://doi.org/10.1103/PhysRevA.101.032308)
7. Cerezo et al., "Variational quantum algorithms," *Nat. Rev. Phys.* 3 (2021). DOI: [10.1038/s42254-021-00348-9](https://doi.org/10.1038/s42254-021-00348-9)
8. Temme, Bravyi & Gambetta, "Error mitigation for short-depth quantum circuits," *Phys. Rev. Lett.* 119 (2017). DOI: [10.1103/PhysRevLett.119.180509](https://doi.org/10.1103/PhysRevLett.119.180509)
9. Lundberg & Lee, "A unified approach to interpreting model predictions (SHAP)," *NeurIPS* (2017). DOI: [10.48550/arXiv.1705.07874](https://doi.org/10.48550/arXiv.1705.07874)
10. Shaydulin & Wild, "Importance of kernel bandwidth in quantum machine learning," *Phys. Rev. A* 106 (2022). DOI: [10.1103/PhysRevA.106.042407](https://doi.org/10.1103/PhysRevA.106.042407)
11. Thanasilp et al., "Exponential concentration in quantum kernel methods," *Nat. Commun.* 15 (2024). DOI: [10.1038/s41467-024-49287-w](https://doi.org/10.1038/s41467-024-49287-w)
12. Javadi-Abhari et al., "Quantum computing with Qiskit," arXiv:2405.08810 (2024). DOI: [10.48550/arXiv.2405.08810](https://doi.org/10.48550/arXiv.2405.08810)
13. Bergholm et al., "PennyLane: Automatic differentiation of hybrid quantum-classical computations," arXiv:1811.04968 (2018). DOI: [10.48550/arXiv.1811.04968](https://doi.org/10.48550/arXiv.1811.04968)
14. Wolberg, Street & Mangasarian, "Breast Cancer Wisconsin (Diagnostic)," UCI Machine Learning Repository. DOI: [10.24432/C5DW2B](https://doi.org/10.24432/C5DW2B)
15. Gupta et al., "Systematic review of quantum machine learning for digital health," *npj Digit. Med.* 8 (2025). DOI: [10.1038/s41746-025-01597-z](https://doi.org/10.1038/s41746-025-01597-z)
16. WHO, "Noncommunicable diseases — fact sheet" (2025). https://www.who.int/news-room/fact-sheets/detail/noncommunicable-diseases
17. Sathishkumar et al., "Cancer incidence estimates for 2022 & projection for 2025," *Indian J. Med. Res.* (ICMR-NCRP). DOI: [10.4103/ijmr.ijmr_1821_22](https://doi.org/10.4103/ijmr.ijmr_1821_22)
18. NCI SEER, "Cancer Stat Facts: Female Breast Cancer" (2016–2022). https://seer.cancer.gov/statfacts/html/breast.html
19. Department of Science & Technology, Govt. of India, "National Quantum Mission" (2023). https://dst.gov.in/national-quantum-mission-nqm

## Research insight → design choice

| Research insight | Design choice in QuantaDx |
|---|---|
| Quantum kernels can be hard to compute classically [3, 4] | ZZ-map quantum kernel as an alternative similarity |
| Deep random circuits hit barren plateaus [5] | Kernel methods and shallow, hardware-efficient ansätze |
| Kernels concentrate as qubits grow [11] | Bandwidth tuning [10] and α-mix with an RBF kernel |
| No consistent QML advantage in health yet [15] | Rigorous classical baselines and McNemar testing |
| NISQ noise limits circuit depth [2, 8] | 8 qubits, shallow circuits, readout mitigation, ZNE |
| Black-box models erode clinical trust [9] | SHAP on clinical features |

## Datasets

UCI Breast Cancer Wisconsin (Diagnostic) · UCI Heart Disease · Pima Indians Diabetes · Parkinson's Voice ·
Chronic Kidney Disease · TCGA Genomics (roadmap)
