# Ensemble Methods in Machine Learning

## Overview

Ensemble methods combine multiple machine learning models to produce a prediction that is more accurate and robust than any single model alone. This principle — that diverse models collectively outperform individual experts — is the mathematical backbone of Swarm Intelligence's multi-persona architecture.

## Core Ensemble Techniques

### Bagging (Bootstrap Aggregating)

Bagging trains multiple instances of the same algorithm on different random subsets of the training data. Each model sees a slightly different view of the world, and their aggregate prediction reduces variance without increasing bias.

- **Random Forest** is the canonical bagging example: many decision trees, each trained on a bootstrap sample, vote on the final classification.
- The key insight: even though each tree is imperfect, their errors are uncorrelated, so they cancel out in the aggregate.
- **Swarm Intelligence parallel**: Each persona sees the same query but through a different cognitive lens. Their errors in reasoning are uncorrelated because they apply different evaluative criteria. The synthesis reduces individual blind spots.

### Boosting

Boosting trains models sequentially, with each new model focusing on the examples the previous models got wrong. The ensemble progressively becomes stronger on the hardest cases.

- **AdaBoost, Gradient Boosting, XGBoost** are the standard implementations.
- Boosting weights difficult examples more heavily, forcing the ensemble to improve where it is weakest.
- **Swarm Intelligence parallel**: When a persona struggles with a domain (e.g., the Artist on a database question), its weight decreases. When it contributes meaningfully outside its expected domain, the weight increases. The system learns which personas to trust for which topics.

### Mixture of Experts

A gating network routes each input to the most relevant expert sub-model. Different inputs activate different experts, and the gating network learns which expert handles which type of input best.

- Each expert specializes in a region of the input space.
- The gating network's routing decisions are themselves learned.
- **Swarm Intelligence parallel**: Dynamic weighting acts as the gating network. Technical questions route more weight to the Engineer. Ethical questions route more to the Philosopher. The routing improves over time as the brain accumulates interaction data.

## Why Diversity Improves Accuracy

### Condorcet's Jury Theorem (1785)

If each voter has an independent probability p > 0.5 of being correct, the probability that the majority vote is correct approaches 1 as the number of voters increases. The critical assumptions:

1. **Independence**: Voters must make errors independently. Correlated errors destroy the benefit.
2. **Competence**: Each voter must be better than random (p > 0.5).
3. **Aggregation**: A good voting mechanism must exist.

Swarm Intelligence satisfies all three: personas reason independently (no anchoring during analysis phase), each persona is competent in its domain, and the voting/synthesis mechanism aggregates effectively.

### Bias-Variance Decomposition

Ensemble methods work because they address the bias-variance tradeoff:

- **Bagging reduces variance** by averaging over diverse models. Individual models overfit to their training data; the ensemble smooths this out.
- **Boosting reduces bias** by focusing successive models on remaining errors. The ensemble progressively improves on hard cases.
- **Swarm Intelligence reduces both**: Multiple perspectives reduce the variance of individual reasoning biases, while dynamic weighting reduces the bias of always applying the same cognitive style.

## Implementation: Personas as Models

In Swarm Intelligence, each persona functions as a "model" in the ensemble sense:

| Ensemble Concept | Swarm Intelligence Equivalent |
|---|---|
| Base model | Persona (Scientist, Artist, Engineer, Philosopher) |
| Training data | System prompt + domain knowledge |
| Input | User query |
| Prediction | Persona's analysis and recommendation |
| Aggregation | Voting mechanism + synthesis meta-prompt |
| Gating network | Dynamic weighting based on topic classification |
| Boosting weight | Persona weight adjusted by historical accuracy |

## Theoretical Limits

Ensemble methods are not magic. They fail when:

1. **All models share the same bias** — if every persona has the same blind spot, the ensemble inherits it. This is why genuine cognitive diversity matters.
2. **Correlated errors** — if personas influence each other during reasoning, independence is lost. This is why the analysis phase runs in isolation.
3. **Poor aggregation** — even with diverse, independent, competent models, a bad voting mechanism can produce worse results than the best individual. The synthesis prompt must be carefully designed.

## Key References

- Dietterich, T. G. (2000). "Ensemble Methods in Machine Learning." Multiple Classifier Systems.
- Breiman, L. (1996). "Bagging Predictors." Machine Learning.
- Freund, Y. & Schapire, R. (1997). "A Decision-Theoretic Generalization of On-Line Learning." Journal of Computer and System Sciences.
- Jacobs, R. et al. (1991). "Adaptive Mixtures of Local Experts." Neural Computation.

## Implications for Swarm Intelligence

The ensemble methods literature tells us that the biggest gains come from diversity, not individual model quality. A diverse group of mediocre models beats a homogeneous group of excellent models. This validates the core design: four cognitively distinct personas, each with genuine reasoning differences, will collectively outperform a single "smart" persona on the full range of human queries.
