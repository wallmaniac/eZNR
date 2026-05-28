import asyncio
import aiohttp
import time
import statistics

# ==============================================================================
# eZNR SAFE LOAD TEST SCRIPT
# ==============================================================================
# This script simulates 200 concurrent users accessing the eZNR platform.
# 
# WHY IS THIS SAFE & FREE?
# 1. It only requests the Next.js pages (Vercel SSR/CSR), which tests your 
#    hosting infrastructure's ability to serve the app under heavy load.
# 2. It DOES NOT trigger Firebase Firestore reads/writes.
# 3. It DOES NOT call Zia AI (Google LLM API).
# Therefore, it will NOT incur any surprise Firebase or API costs.
# ==============================================================================

TARGET_URLS = [
    "https://zastitanaradu.ba/",            # Landing page
    "https://zastitanaradu.ba/login",       # Login page
    "https://zastitanaradu.ba/manifest.json" # PWA shell initialization
]

CONCURRENT_USERS = 200
REQUESTS_PER_USER = 3 # Each user hits 3 URLs

async def fetch(session, url, user_id):
    start_time = time.time()
    try:
        async with session.get(url, timeout=10) as response:
            await response.read()
            latency = time.time() - start_time
            return {"status": response.status, "latency": latency, "url": url}
    except Exception as e:
        return {"status": "ERROR", "latency": time.time() - start_time, "url": url, "error": str(e)}

async def simulate_user(user_id, session, results):
    # Simulate a user clicking through the app
    for url in TARGET_URLS:
        result = await fetch(session, url, user_id)
        results.append(result)
        # Simulate human wait time between clicks (0.5s - 1.5s)
        await asyncio.sleep(0.5)

async def main():
    print(f"Starting SAFE load test with {CONCURRENT_USERS} concurrent users...")
    print(f"WARNING: This will NOT charge your Firebase or AI accounts.")
    print("-" * 50)
    
    results = []
    start_time = time.time()
    
    # We use aiohttp to send asynchronous requests
    connector = aiohttp.TCPConnector(limit=CONCURRENT_USERS)
    async with aiohttp.ClientSession(connector=connector) as session:
        # Create tasks for 200 users
        tasks = [simulate_user(i, session, results) for i in range(CONCURRENT_USERS)]
        await asyncio.gather(*tasks)
        
    total_time = time.time() - start_time
    
    # ==========================================================================
    # ANALYZE RESULTS
    # ==========================================================================
    success_count = sum(1 for r in results if r["status"] == 200)
    error_count = len(results) - success_count
    
    latencies = [r["latency"] for r in results if r["status"] == 200]
    
    print("\n--- LOAD TEST RESULTS ---")
    print(f"Total Time:      {total_time:.2f} seconds")
    print(f"Total Requests:  {len(results)}")
    print(f"Successful:      {success_count} (OK)")
    print(f"Errors/Failed:   {error_count} (FAIL)")
    
    if latencies:
        print(f"\n--- VERCEL RESPONSE TIMES ---")
        print(f"Average Latency: {statistics.mean(latencies):.3f}s")
        print(f"Median Latency:  {statistics.median(latencies):.3f}s")
        print(f"Fastest Request: {min(latencies):.3f}s")
        print(f"Slowest Request: {max(latencies):.3f}s")
        
        # Calculate 95th percentile
        sorted_latencies = sorted(latencies)
        p95_idx = int(len(sorted_latencies) * 0.95)
        print(f"95th Percentile: {sorted_latencies[p95_idx]:.3f}s (95% of users load faster than this)")
        
    if error_count > 0:
        print("\n--- ERRORS ENCOUNTERED ---")
        errors = [r for r in results if r["status"] != 200][:5]
        for e in errors:
            print(f"[{e['status']}] {e['url']} -> {e.get('error', 'HTTP Error')}")

if __name__ == "__main__":
    # Ensure Windows compatibility for asyncio
    import sys
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    asyncio.run(main())
