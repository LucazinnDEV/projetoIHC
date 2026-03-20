import urllib.request
import urllib.parse
import json
import os

OVERPASS_URL = "http://overpass-api.de/api/interpreter"
# Bounding box covering mostly the island of Recife Antigo and close surroundings
QUERY = """
[out:json][timeout:25];
(
  relation["type"="route"]["route"="bus"](-8.0750, -34.8850, -8.0500, -34.8600);
);
out body;
>;
out skel qt;
"""

def fetch_data():
    print("Fetching data from Overpass API (Recife Antigo bus routes)...")
    data = urllib.parse.urlencode({'data': QUERY}).encode('utf-8')
    req = urllib.request.Request(OVERPASS_URL, data=data)
    with urllib.request.urlopen(req) as response:
        response_data = response.read()
    
    data = json.loads(response_data)
    
    nodes = {el['id']: [el['lat'], el['lon']] for el in data['elements'] if el['type'] == 'node'}
    ways = {}
    for el in data['elements']:
        if el['type'] == 'way':
            path = []
            for n_id in el.get('nodes', []):
                if n_id in nodes:
                    path.append(nodes[n_id])
            ways[el['id']] = path
            
    routes = []
    colors = ['#FF0000', '#00FF00', '#0000FF', '#FF6B35', '#4ECDC4', '#9B59B6', '#F1C40F', '#E67E22', '#34495E', '#1ABC9C', '#D35400']
    color_idx = 0
    
    for el in data['elements']:
        if el['type'] == 'relation' and el.get('tags', {}).get('route') == 'bus':
            tags = el.get('tags', {})
            route_name = tags.get('name') or tags.get('ref') or f"Rota {el['id']}"
            if " - " not in route_name and tags.get('ref'):
                route_name = f"{tags['ref']} - {route_name}"
                
            path_coords = []
            stops_coords = []
            
            for mem in el.get('members', []):
                if mem['type'] == 'way' and mem['ref'] in ways:
                    path_coords.extend(ways[mem['ref']])
                elif mem['type'] == 'node' and mem['ref'] in nodes and mem.get('role') in ['stop', 'platform', 'stop_entry_only', 'stop_exit_only']:
                    stops_coords.append(nodes[mem['ref']])
            
            dedup_path = []
            for pt in path_coords:
                if not dedup_path or dedup_path[-1] != pt:
                    dedup_path.append(pt)
            
            if len(dedup_path) > 2:
                routes.append({
                    "id": el['id'],
                    "name": route_name,
                    "color": colors[color_idx % len(colors)],
                    "path": dedup_path,
                    "stops": stops_coords
                })
                color_idx += 1
                
    print(f"Processed {len(routes)} bus routes passing through Recife Antigo.")
    
    assets_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets')
    os.makedirs(assets_dir, exist_ok=True)
    
    out_path = os.path.join(assets_dir, 'rotas.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(routes, f, ensure_ascii=False, indent=2)
    print(f"Saved to {out_path}")

if __name__ == "__main__":
    fetch_data()
