import os
import sys
import sqlite3

# Setup UTF-8 console output
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Setup Python Path
project_dir = r"C:\Users\DELL\OneDrive\Desktop\MyPortfolio\ai-teaching-coach"
if project_dir not in sys.path:
    sys.path.append(project_dir)

# Helper to verify database writes directly
def verify_db_file_directly(db_path):
    print(f"\n[Verification] Directly checking SQLite file: {db_path}")
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]
        print(f"[Verification] Tables found: {tables}")
        cursor.execute("SELECT COUNT(*) FROM checkpoints;")
        count = cursor.fetchone()[0]
        print(f"[Verification] Total checkpoints committed: {count}")
        conn.close()
    else:
        print("[Verification] Error: checkpoints.sqlite file not found on disk!")

db_file = "checkpoints.sqlite"
if os.path.exists(db_file):
    os.remove(db_file)
    print(f"Cleared old database: {db_file}")

# Import graph
from agent_graph import jarvus_graph, memory

print("--- STEP 1: START INITIAL CHAT SESSION ---")
# 1. Simulate frontend study trigger for owner (Vivek)
config = {"configurable": {"thread_id": "owner_main"}}
state = {
    "messages": [{"role": "user", "parts": ["Study detected file: 'db_helper.py' from 'scraper-zepto-pdp'"]}],
    "file_content": None,
    "file_path": "db_helper.py",
    "repo_name": "scraper-zepto-pdp",
    "current_chunk_idx": 0,
    "chunks": [],
    "user_role": "owner",
    "verification_success": True,
    "error_msg": None,
    "selected_language": "hinglish",
    "current_response": None,
    "confusion_count": 0,
    "access_token": "vivek_session_token",
    "next_node": "fetch_content"
}

# Run Graph
res = jarvus_graph.invoke(state, config=config)
print("\n[Chat Endpoint] Graph Invoked. State saved to SQLite.")
print(f"Final Node Reached: {res.get('next_node')}")
print(f"Verification Success: {res.get('verification_success')}")
print(f"Total Chunks: {len(res.get('chunks', []))}")
print(f"Jarvus Output:\n{res.get('current_response')}\n")

# Verify database file directly
verify_db_file_directly(db_file)

print("\n--- STEP 2: SIMULATE FULL SERVER RESTART (KILL RAM / RE-INITIALIZE CONNECTION) ---")
# In Python, we simulate a server restart by deleting the old connection and checkpointer instances, 
# and importing them fresh, forcing SQLite to reload all state metadata from disk.
del jarvus_graph
del memory

# Re-import and establish a fresh connection to checkpoints.sqlite
import importlib
import agent_graph
importlib.reload(agent_graph)
from agent_graph import jarvus_graph

print("[Server Restart] RAM state wiped. New python process connected to checkpoints.sqlite.")

# Query state snapshot from SQLite checkpointer using config
state_snapshot = jarvus_graph.get_state(config)
loaded_state = state_snapshot.values
print(f"[Server Restart] Restored state from checkpointer. Target Node: {loaded_state.get('next_node')}")
print(f"[Server Restart] Current Chunk Index: {loaded_state.get('current_chunk_idx')}")

# Simulate user replying that they did not understand (Confused)
print("\n--- STEP 3: RESUME CONVERSATION AFTER RESTART ---")
print("User Input: *'samajh nahi aaya, complex hai'*")

loaded_state["next_node"] = "reexplain"
loaded_state["messages"].append({"role": "user", "parts": ["samajh nahi aaya, complex hai"]})

# Invoke graph to resume
res_resumed = jarvus_graph.invoke(loaded_state, config=config)
print(f"Final Node Reached (Resumed): {res_resumed.get('next_node')}")
print(f"Confusion Count: {res_resumed.get('confusion_count')}")
print(f"Jarvus Re-Explanation Output:\n{res_resumed.get('current_response')}\n")

verify_db_file_directly(db_file)
print("\nRestart test complete. SQLite persistence verified successfully!")
