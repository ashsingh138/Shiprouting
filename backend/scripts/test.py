import json
import random
import os

INPUT_FILE = "app/data/ships_db.json"
OUTPUT_FILE = "app/data/ships_db_small.json"

TARGET_SIZE_MB = 70
TARGET_BYTES = TARGET_SIZE_MB * 1024 * 1024

sampled_data = []
current_size = 0

# Read full JSON
with open(INPUT_FILE, "r") as f:
    data = json.load(f)

# Shuffle to ensure randomness
random.shuffle(data)

for entry in data:
    entry_str = json.dumps(entry, separators=(',', ':'))
    entry_size = len(entry_str.encode("utf-8"))

    # Stop when target size reached
    if current_size + entry_size > TARGET_BYTES:
        break

    sampled_data.append(entry)
    current_size += entry_size

print(f"Selected entries: {len(sampled_data)}")
print(f"Approx size: {current_size / (1024*1024):.2f} MB")

# Save compact JSON (important for size)
with open(OUTPUT_FILE, "w") as f:
    json.dump(sampled_data, f, separators=(',', ':'))

# Final size check
final_size = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)
print(f"Final file size: {final_size:.2f} MB")