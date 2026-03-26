import matplotlib.pyplot as plt

# Metrics
metrics = ["Accuracy", "Macro F1", "Weighted F1", "Balanced Accuracy"]

# Values (from your results)
rf = [98.68, 98.49, 98.73, 99.06]
cb = [98.57, 98.38, 98.63, 98.59]

x = range(len(metrics))

# Plot bars
plt.bar(x, rf, width=0.4, label="Random Forest")
plt.bar([i + 0.4 for i in x], cb, width=0.4, label="CatBoost")

# Labels
plt.xticks([i + 0.2 for i in x], metrics, rotation=20)
plt.ylabel("Score (%)")
plt.title("Model Performance Comparison")

plt.legend()
plt.tight_layout()

# Save image
plt.savefig("model_comparison.png", dpi=300)

# Show plot
plt.show()