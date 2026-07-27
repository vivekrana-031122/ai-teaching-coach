import os
import sys
import json

# Force stdout encoding to UTF-8 on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Setup Python Path
project_dir = r"C:\Users\DELL\OneDrive\Desktop\MyPortfolio\ai-teaching-coach"
if project_dir not in sys.path:
    sys.path.append(project_dir)

from agent_graph import jarvus_graph

# Setup output markdown file
output_md = r"C:\Users\DELL\.gemini\antigravity\brain\7ad02c71-ccf6-4640-92c8-c43671f6479d\graph_test_results.md"

log_buffer = []
def log_print(msg):
    print(msg)
    log_buffer.append(msg)

log_print("# 📊 Jarvus LangGraph State Machine Test Results")
log_print("This document displays the execution transcripts and state transition traces of the Jarvus graph.")
log_print("")

# Mock PENDING_APPROVALS inside main to prevent HTTP errors during local graph testing
import main
main.PENDING_APPROVALS = {}

# --- TEST 1: HAPPY PATH TEST ---
log_print("## 🟢 1. Happy Path Test: Greet and then Teach db_helper.py")
log_print("We initiate the session, greet Vivek, and then trigger a study session for `db_helper.py` in `scraper-zepto-pdp` repository.")

# Step A: Greet Vivek
state_init = {
    "messages": [],
    "file_content": None,
    "file_path": None,
    "repo_name": None,
    "current_chunk_idx": 0,
    "chunks": [],
    "user_role": "owner",
    "verification_success": True,
    "error_msg": None,
    "selected_language": "hinglish",
    "current_response": None,
    "confusion_count": 0,
    "access_token": "owner_test_token",
    "next_node": "identify_user"
}

log_print("\n### Step A: Greet Run")
config = {"configurable": {"thread_id": "happy_path_thread"}}
try:
    res_greet = jarvus_graph.invoke(state_init, config=config)
    log_print(f"**Node Reached:** `{res_greet.get('next_node')}`")
    log_print(f"**Jarvus Output:**\n\n{res_greet.get('current_response')}\n")
    
    # Step B: Load db_helper.py
    log_print("\n### Step B: Fetch & Explain First Chunk")
    res_greet["file_path"] = "db_helper.py"
    res_greet["repo_name"] = "scraper-zepto-pdp"
    res_greet["next_node"] = "fetch_content"
    res_greet["messages"].append({"role": "user", "parts": ["Study detected file: 'db_helper.py' from 'scraper-zepto-pdp'"]})
    
    res_fetch = jarvus_graph.invoke(res_greet, config=config)
    log_print(f"**Node Reached:** `{res_fetch.get('next_node')}`")
    log_print(f"**Verification Status:** `{res_fetch.get('verification_success')}`")
    log_print(f"**Total Chunks Created:** `{len(res_fetch.get('chunks', []))}`")
    log_print(f"**Jarvus Output (Explanation):**\n\n{res_fetch.get('current_response')}\n")
    
    # Step C: User reports confusion
    log_print("\n### Step C: User says 'samajh nahi aaya' (Confusion Loop)")
    res_fetch["next_node"] = "reexplain"
    res_fetch["messages"].append({"role": "user", "parts": ["samajh nahi aaya"]})
    
    res_confused = jarvus_graph.invoke(res_fetch, config=config)
    log_print(f"**Node Reached:** `{res_confused.get('next_node')}`")
    log_print(f"**Confusion Count:** `{res_confused.get('confusion_count')}`")
    log_print(f"**Jarvus Output (Re-Explanation):**\n\n{res_confused.get('current_response')}\n")

    # Step D: User understood
    log_print("\n### Step D: User says 'haan, clear hai' (Proceed to next chunk)")
    res_confused["next_node"] = "next_chunk_or_recall"
    res_confused["messages"].append({"role": "user", "parts": ["haan, clear hai"]})
    
    # Force next_node route to avoid index out of bounds in test (if total chunks <= 1)
    if len(res_confused.get("chunks", [])) <= 1:
        res_confused["next_node"] = "next_chunk_or_recall"
        
    res_next = jarvus_graph.invoke(res_confused, config=config)
    log_print(f"**Node Reached:** `{res_next.get('next_node')}`")
    log_print(f"**Jarvus Output:**\n\n{res_next.get('current_response')}\n")

except Exception as e:
    log_print(f"❌ Test 1 Error: {e}")


# --- TEST 2: FAILURE PATH TEST ---
log_print("## 🔴 2. Failure Path Test: Wrong File Path")
log_print("Simulating fetch request for `wrong_helper.py` which does not exist in the repository.")

state_fail = {
    "messages": [],
    "file_content": None,
    "file_path": "wrong_helper.py",
    "repo_name": "scraper-zepto-pdp",
    "current_chunk_idx": 0,
    "chunks": [],
    "user_role": "owner",
    "verification_success": True,
    "error_msg": None,
    "selected_language": "hinglish",
    "current_response": None,
    "confusion_count": 0,
    "access_token": "owner_test_token",
    "next_node": "fetch_content" # Start directly from fetch_content to trigger validation
}

log_print("### State Transitions Output:")
config_fail = {"configurable": {"thread_id": "failure_path_thread"}}
try:
    res_fail = jarvus_graph.invoke(state_fail, config=config_fail)
    log_print(f"**Final Node Reached:** `{res_fail.get('next_node')}`")
    log_print(f"**Verification Status:** `{res_fail.get('verification_success')}`")
    log_print(f"**Jarvus Output:**\n\n{res_fail.get('current_response')}\n")
except Exception as e:
    log_print(f"❌ Test 2 Error: {e}")

# Write to file
with open(output_md, "w", encoding="utf-8") as f:
    f.write("\n".join(log_buffer))

print(f"Tests complete. Results written to {output_md}")
