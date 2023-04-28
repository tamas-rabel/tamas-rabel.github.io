var canvas = null;
var ctx = null;
var g_heightmap = null;
var g_biomemap = null;
var g_hexmap = null;
var g_settlements = [];
var g_width = 25;
var g_height = 20;
var g_tile_cache = {};
var g_random = null
var g_display_mode = "display-normal";
var g_height_power = 1;
var g_height_offset = 0;
var g_height_range = 1;
var g_biome_offset = 0;
var g_smooth_rivers = true;
var g_num_rivers = 4;
var g_swamp_threshold = 1.2;
var g_rivers = [];
var g_show_hexes = false;
var g_seed = null;
var g_hex_width = 104;
var g_hex_height = 90;
var g_river_overlay = null;
var g_settlement_overlay = null;
var g_road_overlay = null;
var g_border_overlay = null;
var g_river_blob = null;
var g_settlement_blob = null;
var g_road_blob = null;
var g_border_blob = null;
var g_elevation_overlay = null;
var g_display_elevation = false;
var g_num_biome_iterations = 10;
var g_show_numbers = true;
var g_num_cities = 5;
var g_num_towns = 5;
var g_ocean_tiles = [];
var g_roads = [];
var g_road_simplification_threshold = 16;
var g_show_settlements = true;
var g_show_roads = true;
var g_show_borders = true;

function set_seed(s)
{
	if (s == null) s = new Date().getTime();
	g_random = new MersenneTwister(s);
    g_seed = s;
}

function init()
{    	
    canvas = document.getElementById("canvas")
    canvas.width = get_hex_center(g_width, 0).x - g_hex_width/2+2;
    canvas.height = get_hex_center(1, g_height-1).y;
    ctx = canvas.getContext('2d');
    
    g_river_overlay = new OffscreenCanvas(canvas.width + g_hex_width/4, canvas.height + g_hex_height/2);
    g_elevation_overlay = new OffscreenCanvas(canvas.width + g_hex_width/4, canvas.height + g_hex_height/2);
    g_settlement_overlay = new OffscreenCanvas(canvas.width + g_hex_width/4, canvas.height + g_hex_height/2);
    g_road_overlay = new OffscreenCanvas(canvas.width + g_hex_width/4, canvas.height + g_hex_height/2);
    g_border_overlay = new OffscreenCanvas(canvas.width + g_hex_width/4, canvas.height + g_hex_height/2);
    
    g_heightmap = new Float32Array(g_width * g_height);
    g_biomemap = new Float32Array(g_width * g_height);
    g_hexmap = new Array(g_width * g_height);
    g_ocean_tiles = new Uint8Array(g_width * g_height);
 
    let inputs = document.getElementById("controls").getElementsByTagName("input");
    for (let i=0; i<inputs.length; i++)
    {
        let input = inputs[i];
        input.addEventListener("change", update_url);
    }
    
    window.addEventListener("popstate", parse_url);
    
    parse_url();
    update_url();
}

function roll(dice)
{
//    return Math.floor(Math.random() * dice) + 1;
	return (g_random.int() % dice) + 1;
}

function select_random_hex()
{
    return { x: roll(g_width), y: roll(g_height) };
}

function get_hex_center_h(hex)
{
    return get_hex_center(hex.x, hex.y);
}

function get_hex_center(x, y)
{
//    return { x: x * 104/2, y: y * 90/2 + (x%2) * 90/4 }
    return { x: (x * (g_hex_width*3/4 - 1) + g_hex_width/4), y: y * (g_hex_height) + (x%2) * g_hex_height/2 }
}

function get_neighbour(x, y, d)
{
    let yy = y + (x % 2);
    switch (d)
    {
        case 0: return { x: x,   y: y-1  };
        case 1: return { x: x-1, y: yy-1 }
        case 2: return { x: x-1, y: yy   }
        case 3: return { x: x,   y: y+1  };
        case 4: return { x: x+1, y: yy   };
        case 5: return { x: x+1, y: yy-1 };
    }
    
    return {x: x, y: y};
}

function compute_average(x, y, v, dataset)
{
    let hex1 = get_neighbour(x, y, v);
    let hex2 = get_neighbour(x, y, (v+1)%6);
    let w = 1.0;
    let result = dataset[y * g_width + x];
    if (hex1.x >= 0 && hex1.x < g_width && hex1.y >= 0 && hex1.y < g_width)
    {
        result += dataset[hex1.y * g_width + hex1.x];
        w += 1.0;
    }
    if (hex2.x >= 0 && hex2.x < g_width && hex2.y >= 0 && hex2.y < g_width)
    {
        result += dataset[hex2.y * g_width + hex2.x];
        w += 1.0;
    }
    
    return result / w;
}

function find_hex(y, x)
{
    y -= g_hex_width/8;
    let size = g_hex_width / 2;
    x /= size * Math.sqrt(3);
    y /= size * Math.sqrt(3);
    temp = Math.floor(x + Math.sqrt(3) * y + 1)
    q = Math.floor((Math.floor(2*x+1) + temp) / 3);
    r = Math.floor((temp + Math.floor(-x + Math.sqrt(3) * y + 1))/3);
    
    let row = q - (r + (r & 1)) / 2
    let col = r

    return {x: col, y: row};
}

function get_hex_vertex_h(hex, v)
{
    return get_hex_vertex(hex.x, hex.y, v);
}

function get_hex_vertex(x, y, v)
{
    let hex = get_hex_center(x, y);
    switch (v)
    {
        case 0: return {x: Math.floor(hex.x - g_hex_width/4 + 1), y: (hex.y - g_hex_height/2-1) };
        case 1: return {x: Math.floor(hex.x - g_hex_width/2 + 1), y: (hex.y - 1 + (x%2)) };
        case 2: return {x: Math.floor(hex.x - g_hex_width/4 + 1), y: (hex.y + g_hex_height/2) };
        case 3: return {x: Math.floor(hex.x + g_hex_width/4    ), y: (hex.y + g_hex_height/2) };
        case 4: return {x: Math.floor(hex.x + g_hex_width/2    ), y: (hex.y - 1 + (x%2)) };
        case 5: return {x: Math.floor(hex.x + g_hex_width/4    ), y: (hex.y - g_hex_height/2-1) };
    }
    
    return hex;
}

function lerp(x, y, alpha)
{
    return x + (y - x) * alpha;
}

function blot(dice, target, mode)
{
    let hex = select_random_hex();
	hex.x = roll(g_width + 8) - 4;
	hex.y = roll(g_height + 8) - 4;
    let pos = {x: hex.x, y: hex.y};
    let cm = 1; //900 / 21;
    let radius = Math.floor((2 * cm + roll(dice) / 3 * cm) / 2);
	let jitter = (roll(200) / 100.0 - 1.0) * roll(100) * 0.01;
//    let e = (mode == 0) ? (roll(dice)) : roll(8);
    let e = (mode == 0) ? (dice*dice) : roll(8);
    
    for (let y=-radius; y<=radius; y++)
    {
        if (pos.y+y<0 || pos.y+y>=g_height) continue;
        
        for (let x=-radius; x<=radius; x++)
        {
            if (pos.x+x<0 || pos.x+x>=g_width) continue;
                      
            let index = ((pos.y + y) * g_width + pos.x + x);
            let d = radius - Math.sqrt(x*x + y*y);
			switch (mode)
			{
            case 0:
                {
                    //d = (d < 0) ? 0 : (Math.max(radius, 0.0) / 8.0);
                    //d += jitter;
                    //target[index] += d;
                    if (d >= 0)
                    {
                        let alpha = Math.min(d * 0.3, 1.0);
                        //target[index] = lerp(target[index], e, alpha);
                        //e += jitter;
                        target[index] += e * alpha;
                    }
                }
                break;
            case 1:
                {
                    if (d >= 0)
                    {
                        target[index] = e;
                    }
                }
                break;
			}
//            target[index] = Math.max(target[index], d);
        }        
    }
}

function increase_biome(x, y, v)
{
    if (x<0 || y<0 || x>=g_width || y>=g_height) return;
    g_biomemap[y * g_width + x] += v;
}

function process_hex(x, y, callback)
{
    if (y > 0) callback(x  , y-1);
    if (y < g_height-1) callback(x  , y+1);
    if (x > 0) callback(x-1, y  );
    if (x < g_width-1) callback(x+1, y  );
    if ((x%2) == 0)
    {
        if (y > 0 && x > 0) callback(x-1, y-1);
        if (y > 0 && x < g_width-1) callback(x+1, y-1);
    }
    else
    {
        if (y < g_height-1 && x > 0) callback(x-1, y+1);
        if (y < g_height-1 && x < g_width-1) callback(x+1, y+1);
    }
}

// 1680538861943
function generate_rivers(water_sources)
{
    g_rivers =[];
    
    for (let i=0; i<g_num_rivers && water_sources.length > 0; i++)
    {
        let river = []
        let history = new Array(g_width * g_height * 6)
        for (let h=0; h<g_width * g_height * 6; h++) history[h] = 0;
        let current_hex = water_sources.splice(roll(water_sources.length) - 1, 1)[0];
        let current_vertex = roll(6) - 1;
        while (current_hex != null)
        {
            if (compute_tile(current_hex.x, current_hex.y) == "costal_water") break;
            
            river.push({x: current_hex.x, y: current_hex.y, v: current_vertex});
//            let lowest_height = g_heightmap[current_hex.y * g_width + current_hex.x];
            let lowest_height = compute_average(current_hex.x, current_hex.y, current_vertex, g_heightmap);
            let lowest_hex = current_hex;
            let lowest_vertex = current_vertex;
            let valid = false;
            for (let n=0; n<3; n++)
            {
                let hex = (n == 1) ? get_neighbour(current_hex.x, current_hex.y, current_vertex) : current_hex;
                let v = (n == 1) ? ((current_vertex + 1) % 6) : ((current_vertex + 5 + n) % 6);
                let h = compute_average(hex.x, hex.y, v, g_heightmap);
                if (h <= lowest_height && history[hex.y * g_width * 6 + hex.x * 6 + v] == 0)
                {
                    lowest_height = h;
                    lowest_hex = hex;
                    lowest_vertex = v;
                    history[hex.y * g_width * 6 + hex.x * 6 + v] = 1;
                    valid = true;
                }
            }
            
            if (!valid)
            {
                g_biomemap[current_hex.y * g_width + current_hex.x] = 100;
                break;
            }
            
            current_hex = lowest_hex;
            current_vertex = lowest_vertex;
        }
        
        // Fix up end point
        let positions = [];
        for (let r=0; r<river.length; r++)
        {
            let current_hex = river[r];
            let current_vertex = current_hex.v;
            
            let pos = get_hex_vertex_h(current_hex, current_vertex);
            pos.x += g_hex_width/4;
            pos.y += g_hex_height/2;
            positions.push(pos);

            let water = compute_tile(current_hex.x, current_hex.y) == "costal_water";
            water = water || compute_tile_h(get_neighbour(current_hex.x, current_hex.y, current_vertex)) == "costal_water";
            water = water || compute_tile_h(get_neighbour(current_hex.x, current_hex.y, current_vertex + 1)) == "costal_water";
            
            if (water)
            {
                river.splice(r, river.length - r);
                break;
            }
        }
        
        // Update biomes
        for (let r=0; r<river.length; r++)
        {
            let current_hex = river[r];
            let current_vertex = current_hex.v;
            
            for (let v=0; v<3; v++)
            {
                let hex = (v == 2) ? current_hex : get_neighbour(current_hex.x, current_hex.y, current_vertex + v)
                g_biomemap[hex.y * g_width + hex.x] = Math.min(g_biomemap[hex.y * g_width + hex.x] + 0.1, 1.0);
            }
        }
        
        g_rivers.push(positions);
    }    
}

function compute_score(x, y)
{
    let score = 0;
    
    if (x == 0 || y == 0 || x == g_width-1 || y == g_height-1) return -10000;
    
    switch (g_hexmap[y * g_width + x])
    {
        case "costal_water": score += -10; break;
        case "desert_sandy": score += -5; break;
        case "grass": score += 10; break;
        case "forested_hills": score += 8; break;
        case "heavy_forest": score += 4; break;
        case "hills": score += 0; break;
        case "hills_green": score += 2; break;
        case "jungle": score += -2; break;
        case "jungle_hills": score += -4; break; 
        case "light_forest": score += 6; break;
        case "mountains": score += 0; break;
        case "swamp": score += -15; break;
        case "farmland": score += 20; break;
    }
    
    let neighbours = {}
    for (let n=0; n<6; n++)
    {
        let pos = get_neighbour(x, y, n);
        let type = g_hexmap[pos.y * g_width + pos.x];
        switch (type)
        {
            case "costal_water":
                if (!("costal_water" in neighbours))
                {
                    if (g_ocean_tiles[pos.y * g_width + pos.x] == 1)
                    {
                        score += 20; 
                    }
                    else
                    {
                        score += 2; 
                    }
                }
                break;
            case "desert_sandy": if (!("desert_sandy" in neighbours)) score += 0; break;
            case "grass":
                if (!("grass" in neighbours))
                {
                    score += 2;
                }
                else
                {
                    score += 0.1;
                }
                break;
            case "forested_hills": if (!("forested_hills" in neighbours)) score += 4; break;
            case "heavy_forest": if (!("heavy_forest" in neighbours)) score += 5; break;
            case "hills": if (!("hills" in neighbours)) score += 3; break;
            case "hills_green": if (!("hills_green" in neighbours)) score += 3; break;
            case "jungle": if (!("jungle" in neighbours)) score += 2; break;
            case "jungle_hills": if (!("jungle_hills" in neighbours)) score += 3; break;
            case "light_forest": if (!("light_forest" in neighbours)) score += 5; break;
            case "mountains": if (!("mountains" in neighbours)) score += 10; break;
            case "swamp": if (!("swamp" in neighbours)) score += 0; break;
            case "farmland": if (!("farmland" in neighbours)) score += 10; break;
        }
        neighbours[type] = true;
    }
    
    return score;
}

var scores = [];
function generate_settlements()
{
    g_roads = [];    
    g_settlements = [];
    for (let i=0; i<g_width * g_height; i++) g_ocean_tiles[i] = 0;

    let found = true;
    while (found)
    {
        found = false;
        for (let y=0; y<g_height; y++)
        {
            for (let x=0; x<g_width; x++)
            {
                let index = y * g_width + x;
                if (g_ocean_tiles[index] != 0) continue;
                
                let type = g_hexmap[y * g_width + x];
                if (type != "costal_water") continue;
                
                if (x == 0 || y == 0 || x == g_width - 1 || y == g_height - 1)
                {
                    g_ocean_tiles[index] = 1;
                    found = true;
                    continue;
                }
                
                for (let n=0; n<6; n++)
                {
                    let pos = get_neighbour(x, y, n);
                    if (g_ocean_tiles[pos.y * g_width + pos.x] == 1)
                    {
                        g_ocean_tiles[index] = 1;
                        found = true;
                        break;
                    }
                }
            }
        }
    }
    
    //let scores = new Array(g_width * g_height);
    scores = new Array(g_width * g_height);
    for (let y=0; y<g_height; y++)
    {
        for (let x=0; x<g_width; x++)
        {
            scores[y * g_width + x] = compute_score(x, y);
        }
    }
	
    // Place cities
    for (let c=0; c<g_num_cities + g_num_towns; c++)
    {
        let settlement_type = (c < g_num_cities) ? "city" : "town";
		let best_score = Math.max(...scores);
		if (best_score < -100) break;
		
        let index = scores.indexOf(best_score);
        
        let cx = Math.floor(index % g_width);
        let cy = Math.floor(index / g_width);
        g_settlements.push({x: cx, y: cy, type: settlement_type});
        
        // Place market villages around cities
        let num_satellites = (settlement_type == "city") ? 4 : 2;
        for (let n=0; n<num_satellites; n++)
        {
            let pos = {x: cx, y: cy};
            let tries = 0;
            for (let s=0; s<2 && tries<10; s++, tries++)
            {
                let new_pos = get_neighbour(pos.x, pos.y, roll(6)-1);
                let type = g_hexmap[new_pos.y * g_width + new_pos.x];
                if ((type == "costal_water" || type == "swamp") && roll(6) < 3)
                {
                    s--;
                    continue;
                }
                
                pos = new_pos;
            }
            if (pos.x < 0 || pos.y < 0 || pos.x >= g_width-1 || pos.y >= g_height-1) continue;
            
            if (pos.x != cx || pos.y != cy)
            {
                let type = g_hexmap[pos.y * g_width + pos.x];
                if (type == "costal_water") continue;
                if (type == "swamp") continue;
				if (g_settlements.find(e => e.x == pos.x && e.y == pos.y) == undefined)
				{
					g_settlements.push({x: pos.x, y: pos.y, type: "village"});
                    let road = find_path({x: cx, y: cy}, pos);
                    if (road != null) g_roads.push(road);
				}
            }
        }
        
        // Update score around the city to have a nice spread of cities
        let clear_radius = (settlement_type == "city") ? 8 : 4;
        for (let y=0; y<g_height; y++)
        {
            for (let x=0; x<g_width; x++)
            {
                let dx = Math.abs(x - cx);
                let dy = Math.abs(y - cy);
                let d = dx + dy;    // Non-Euclidean
                if (d > clear_radius) continue;

                let path = find_path({x: cx, y: cy}, {x: x, y: y});
                if (path != null && path.length > clear_radius) continue;
  
                scores[y * g_width + x] -= lerp(100, 0, d / clear_radius);
            }
        }
    }
    
    g_settlements.sort((a, b) =>
    {
        return a.type.localeCompare(b.type);
    });
    
    // Update biomes
    for (let s=0; s<g_settlements.length; s++)
    {
        let settlement = g_settlements[s];
        if (g_hexmap[settlement.y * g_width + settlement.x] == "grass") g_hexmap[settlement.y * g_width + settlement.x] = "farmland";
        
        if (settlement.type != "village")
        {
            for (let n=0; n<6; n++)
            {
                let pos = get_neighbour(settlement.x, settlement.y, n);
                if (g_hexmap[pos.y * g_width + pos.x] == "grass") g_hexmap[pos.y * g_width + pos.x] = "farmland";
                if (settlement.type != "town")
                {
                    for (let nn=0; nn<6; nn++)
                    {
                        let pos2 = get_neighbour(pos.x, pos.y, nn);
                        if (g_hexmap[pos2.y * g_width + pos2.x] == "grass") g_hexmap[pos2.y * g_width + pos2.x] = "farmland";
                    }
                }
            }
        }
    }
}

function reverse_array(a)
{
    if (a.toReversed) return a.toReversed();
        
    let result = [...a];
    result.reverse();
    return result;
}

function get_roads_from(pos, threshold, debug)
{
    return g_roads.map(road => 
    {       
        if (road.length > threshold) return null;
        if (road.length == 0) return null;

        if (road[0].x == pos.x && road[0].y == pos.y)
        {
            return road;
        }
        else if (road[road.length-1].x == pos.x && road[road.length-1].y == pos.y)
        {
            return reverse_array(road);
        }
        
        return null;
    }).filter(road => road != null);
}

function generate_roads()
{    
    let city_roads = g_roads.length;

    // Connect each city to each other city
    for (let c1=0; c1<g_num_cities-1; c1++)
    {
		let s1 = g_settlements[c1];
        for (let c2=c1+1; c2<g_num_cities; c2++)
        {
			let s2 = g_settlements[c2];
            let road = find_path(s1, s2);
			if (road != null) g_roads.push(road);
        }        
    }

    // Connect each town to a city
    for (let c1=g_num_cities; c1<g_num_cities + g_num_towns; c1++)
    {
		let s1 = g_settlements[c1];
//        let c2 = roll(g_num_cities) - 1;    // #todo Find nearest city
        let road = null;
        for (let c2=0; c2<g_num_cities; c2++)
        {
            let s2 = g_settlements[c2];
            let new_road = find_path(s1, s2);
            if (road == null || road.length > new_road.length) road = new_road;
        }
        if (road != null) g_roads.push(road);
    }
        		
    // Remove unnecessary roads
    for (let r=city_roads; r<g_roads.length; r++)
    {
        let start = g_roads[r][0];
        let end = g_roads[r][g_roads[r].length-1];

        let threshold = g_roads[r].length + g_road_simplification_threshold;
        let options = get_roads_from(start, threshold).filter(road => road != g_roads[r]);
        
        while (options.length > 0)
        {
            let num_options = options.length;
            for (let o=0; o<num_options; o++)
            {
                let option = options[o];
                let current_end = option[option.length - 1];
                let new_options = get_roads_from(current_end, threshold - option.length, r == 3).filter(road => option.find(pos => pos.x == road[road.length-1].x && pos.y == road[road.length-1].y) == undefined);
                for (let n=0; n<new_options.length; n++)
                {
                    let new_option = new_options[n];
                    if (new_option[new_option.length - 1].x == end.x && new_option[new_option.length - 1].y == end.y)
                    {
                        options = [];
                        num_options = 0;
                        g_roads[r] = [];
                        break;
                    }
                    
                    options.push(option.concat(new_option));
                }
            }
            
            options.splice(0, num_options);
        }
    }
    
    for (let r1=g_roads.length-1; r1>=city_roads && false; r1--)
    {
        let start = r1;
        let redundant = r1;
        let road1 = g_roads[r1];
        for (let p=1; p<road1.length-1; p++)
        {
            let pos = road1[p];
            for (let r2=city_roads; r2<r1; r2++)
            {
                let road2 = g_roads[r2];
                if (road2.find(p => p.x == pos.x && p.y == pos.y) == undefined) continue;
                
                redundant = r2;
                break;
            }
            
            if (redundant != r1)
            {
                if (start == r1)
                {
                    road1.splice(0, p);
                    p = 0;
                    start = redundant;
                }
                else if (p == 0)
                {
                    road1.splice(0, p);
                    p = 0;
                    start = redundant;
                }
                else if (start == redundant)
                {
                    road1.splice(0, p);
                    p = 0;
                    start = redundant;
                }
                else if (p == 1)
                {
                    road1.splice(0, p);
                    p = 0;
                    start = redundant;
                }
                else
                {
                    road1.splice(p + 1);
                    break;
                }
//                break;

                redundant = r1;
            }
        }
        
//        if (redundant)
//        {
//            //g_roads.splice(r1, 1);
//        }
    }
}

function generate()
{
	set_seed(g_seed);
    
    // Reset water override
    for (let index=0; index<canvas.width * canvas.height; index++)
    {
        g_heightmap[index] = 0;
        g_biomemap[index] = 0;
    }
    
    // Generate height
    for (let i=0; i<100; i++)
    {
        blot(60, g_heightmap, 0);
        blot( 4, g_heightmap, 0);
        blot( 6, g_heightmap, 0);
        blot( 8, g_heightmap, 0);
        blot(10, g_heightmap, 0);
        blot(12, g_heightmap, 0);
        blot(20, g_heightmap, 0);
    }

    // Normalize height
    let max_height = 0;
	let min_height = 9999;
    for (let i=0; i<g_width * g_height; i++) { max_height = Math.max(max_height, g_heightmap[i]); min_height = Math.min(min_height, g_heightmap[i]); }
    for (let i=0; i<g_width * g_height; i++)
    {
        h = g_heightmap[i];
        h = (h - min_height) / (max_height - min_height);
        h = Math.pow(h, g_height_power);
        h = (h - 0.5) * g_height_range + 0.5;
        h += g_height_offset;
        g_heightmap[i] = h;
    }

    // Generate biomes
    for (let i=0; i<g_num_biome_iterations; i++)
    {
        blot(60, g_biomemap, 1);
        blot( 4, g_biomemap, 1);
        blot( 6, g_biomemap, 1);
        blot( 8, g_biomemap, 1);
        blot(10, g_biomemap, 1);
        blot(12, g_biomemap, 1);
        blot(20, g_biomemap, 1);
    }

    // Normalize biomes
    let max_biome = 0;
	let min_biome = 9999;
    for (let i=0; i<g_width * g_height; i++) { max_biome = Math.max(max_biome, g_biomemap[i]); min_biome = Math.min(min_biome, g_biomemap[i]); }
    for (let i=0; i<g_width * g_height; i++) { g_biomemap[i] = (g_biomemap[i] - min_biome) / (max_biome - min_biome) * 0.85 + g_biome_offset; }

    // Propagate water
    let water_sources = [];
    for (let y=0; y<g_height; y++)
    {
        for (let x=0; x<g_width; x++)
        {
            let tile = compute_tile(x, y);
            
            if (tile == "mountains") water_sources.push({x: x, y: y});
            
            if (tile != "costal_water") continue;
                        
            process_hex(x, y, (ix, iy) => increase_biome(ix, iy, 0.1));
        }
    }
            
    generate_rivers(water_sources);

    // Initial hexmap
    for (let y=0; y<g_height; y++)
    {
        for (let x=0; x<g_width; x++)
        {
            g_hexmap[y * g_width + x] = compute_tile(x, y);
        }
    }        

    generate_settlements();
    generate_roads();

    // Update UI
    document.getElementById("seed").value = g_seed;
    document.getElementById("height-power").value = g_height_power;
    document.getElementById("height-offset").value = g_height_offset;
    document.getElementById("biome-offset").value = g_biome_offset;
    document.getElementById("height-range").value = Math.log2(g_height_range);
    document.getElementById("smooth-rivers").checked = g_smooth_rivers;
    document.getElementById("num-rivers").value = g_num_rivers;
    document.getElementById("swamp-threshold").value = g_swamp_threshold;
    document.getElementById("show-hexes").checked = g_show_hexes;
    document.getElementById("num-biome-iterations").value = g_num_biome_iterations;
    document.getElementById("display-elevation").checked = g_display_elevation;
    document.getElementById("show-numbers").checked = g_show_numbers;
    document.getElementById("num-cities").value = g_num_cities;
    document.getElementById("num-towns").value = g_num_towns;
    document.getElementById("road-simplification-threshold").value = g_road_simplification_threshold;
    document.getElementById("show-settlements").checked = g_show_settlements;
    document.getElementById("show-roads").checked = g_show_roads;
    document.getElementById("show-borders").checked = g_show_borders;

    draw();
    
    update_tiled_export();
    update_export(g_river_blob, "export-river-overlay", "-rivers.png");
}

async function draw_hex(src, x, y, c)
{
    let image = g_tile_cache[src]
    if (image === undefined)
    {
        image = new Image();
        image.src = src;
        g_tile_cache[src] = image;
    }
    
    if (!image.complete)
    {
        await new Promise(resolve => { image.onload = resolve; } );
    }
    
    let pos = get_hex_center(x, y);
    c.drawImage(image, pos.x - g_hex_width/2, pos.y - g_hex_height/2, g_hex_width, g_hex_height);
}

function compute_tile_h(hex)
{
    return compute_tile(hex.x, hex.y);
}

function compute_tile(x, y)
{
    let h = g_heightmap[y * g_width + x];
    let b = g_biomemap[y * g_width + x];
    
    if (b >= 100) return "costal_water";
    if (h < 0.2) return "costal_water";
    if (h < 0.5)
    {
        if (b > g_swamp_threshold - h) return "swamp";
        if (b < 0.1) return "desert_sandy";
        if (b < 0.4) return "grass";
        if (b < 0.6) return "light_forest";
        if (b < 0.99) return "heavy_forest";
        return "swamp";
//        return (h < 0.2) ? "swamp" : "jungle";
    }
    if (h < 0.8)
    {
        if (b < 0.2) return "hills";
        if (b < 0.5) return "hills_green";
        if (b < 0.8) return "forested_hills";
        return "jungle_hills";
    }
    return "mountains";
}

function viridis(t)
{
    const c0 = {r: 0.2777273272234177 , g: 0.005407344544966578, b: 0.3340998053353061 };
    const c1 = {r: 0.1050930431085774 , g: 1.404613529898575   , b: 1.384590162594685  };
    const c2 = {r: -0.3308618287255563, g: 0.214847559468213   , b: 0.09509516302823659};
    const c3 = {r: -4.634230498983486 , g: -5.799100973351585  , b: -19.33244095627987 };
    const c4 = {r: 6.228269936347081  , g: 14.17993336680509   , b: 56.69055260068105  };
    const c5 = {r: 4.776384997670288  , g: -13.74514537774601  , b: -65.35303263337234 };
    const c6 = {r: -5.435455855934631 , g: 4.645852612178535   , b: 26.3124352495832   };

    let result = {};
    result.r = c0.r+t*(c1.r+t*(c2.r+t*(c3.r+t*(c4.r+t*(c5.r+t*c6.r)))));
    result.g = c0.g+t*(c1.g+t*(c2.g+t*(c3.g+t*(c4.g+t*(c5.g+t*c6.g)))));
    result.b = c0.b+t*(c1.b+t*(c2.b+t*(c3.b+t*(c4.b+t*(c5.b+t*c6.b)))));
    
    return result;
}

async function draw_rivers()
{
    c = g_river_overlay.getContext('2d');
    c.clearRect(0, 0, g_river_overlay.width, g_river_overlay.height);
    
    for (let r=0; r<g_rivers.length; r++)
    {            
        let river = g_rivers[r];
        
        c.strokeStyle = "#60B8E2";
        c.lineWidth = 8;
        c.lineCap = "round";
        c.beginPath();
        let prev = null;
        for (let p=0; p<river.length; p++)
        {
            let next = river[p];
            if (p == 0)
            {
                c.moveTo(next.x, next.y);
            }
            else
            {                    
                if (g_smooth_rivers)
                {
                    if (p < river.length - 1)
                    {
                        next.x += roll(g_hex_width/4-1) - g_hex_width/8;
                        next.y += roll(g_hex_width/4-1) - g_hex_width/8;
                        c.quadraticCurveTo(prev.x, prev.y, (prev.x + next.x) * 0.5, (prev.y + next.y) * 0.5);
                    }
                    else
                    {
                        c.quadraticCurveTo(prev.x, prev.y, next.x, next.y);
                    }
                }
                else
                {
                    c.lineTo(next.x, next.y);
                }
//                    c.quadraticCurveTo((prev.x + next.x) * 0.5, (prev.y + next.y) * 0.5, next.x, next.y);
            }
            prev = next
        }
        c.stroke();
    }

    g_river_blob = await g_river_overlay.convertToBlob()
    update_export(g_river_blob, "export-river-overlay", "-rivers.png");
}

async function draw_settlements()
{
    c = g_settlement_overlay.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, g_settlement_overlay.width, g_settlement_overlay.height);
    c.setTransform(1, 0, 0, 1, g_hex_width/4, g_hex_height/2);

    c.textAlign = "center";
    c.font = "32pt Ramaraja";

    for (let s=0; s<g_settlements.length; s++)
    {
        let settlement = g_settlements[s];
        await draw_hex("symbols/" + settlement.type + ".png", settlement.x, settlement.y, c);
    }

    //c.globalCompositeOperation = "luminosity";
    
    for (let s=0; s<g_settlements.length && false; s++)
    {
        let settlement = g_settlements[s];
        if (settlement.type == "city")
        {
            let name = generate_name();
            let pos = get_hex_center(settlement.x, settlement.y);
            //c.lineWidth = 64;
            //c.strokeStyle = '#0002';
            //c.strokeText(name, pos.x, pos.y - g_hex_height/2);
            c.fillStyle = '#000';
            c.fillText(name, pos.x, pos.y - g_hex_height/3);
        }
    }

    c.globalCompositeOperation = "source-over";

    g_settlement_blob = await g_settlement_overlay.convertToBlob()
    update_export(g_settlement_blob, "export-settlement-overlay", "-settlements.png");
}

function compute_cost(x, y)
{
//	return 0;
	
	switch (g_hexmap[y * g_width + x])
	{
        case "costal_water": return 10000; break;
        case "desert_sandy": return 5; break;
//        case "grass": return 1; break;
//        case "forested_hills": return 8; break;
        case "heavy_forest": return 4; break;
//        case "hills": return 4; break;
//        case "hills_green": return 5; break;
//        case "jungle": return -5; break;
//        case "jungle_hills": return 8; break; 
//        case "light_forest": return 0.1; break;
        case "mountains": return 10; break;
        case "swamp": return 8; break;
//        case "farmland": return 1; break;
	}
	
	return 0.5;
}

function distance(p1, p2)
{
	let dx = p1.x - p2.x;
	let dy = p1.y - p2.y;
	
	return Math.sqrt(dx*dx + dy*dy);
}

function find_path(start, end)
{
	// Simple A*
	let paths = [];
	paths.push({steps: [start], cost: distance(start, end)});
	
	let visited = new Uint8Array(g_width * g_height);
	for (let i=0; i<g_width * g_height; i++) visited[i] = 0;
	
	let count = 0;
	while (paths.length > 0 && count < 1000)
	{
		count++; 
		
		paths.sort((a, b) =>
		{
			return a.cost - b.cost;
		})

		let path = paths.shift();
		
		let last = path.steps[path.steps.length - 1];
		
		for (let n=0; n<6; n++)
		{
			let pos = get_neighbour(last.x, last.y, n);
			if (pos.x < 0 || pos.y < 0 || pos.x >= g_width || pos.y >= g_height) continue;
            if (g_hexmap[pos.y * g_width + pos.x] == "costal_water") continue;
			if (visited[pos.y * g_width + pos.x] != 0) continue;
			visited[pos.y * g_width + pos.x] = 1;
			
			//if (path.steps.find(p => p.x == pos.x && p.y == pos.y) != undefined) continue;
			
			let new_path = {steps: [...path.steps], cost: path.cost};
			new_path.steps.push(pos);
			new_path.cost += compute_cost(pos.x, pos.y);
			new_path.cost -= distance(last, end);
			new_path.cost += distance(pos, end);
			//new_path.cost -= (Math.abs(last.x - end.x) + Math.abs(last.y - end.y)) * 2;
			//new_path.cost += (Math.abs(pos.x - end.x) + Math.abs(pos.y - end.y)) * 2;
			
			if (pos.x == end.x && pos.y == end.y)
			{
				return reverse_array(new_path.steps);
			}
			
			paths.push(new_path)
		}
	}
	
    return null;
}

async function draw_roads()
{
    c = g_road_overlay.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, g_road_overlay.width, g_road_overlay.height);
    c.setTransform(1, 0, 0, 1, g_hex_width/4, g_hex_height/2);
	
	//c.globalCompositeOperation = "overlay";

    let colours =
    [
        "#f00",
        "#0f0",
        "#00f",
        "#ff0",
        "#f0f",
        "#000",
        "#fff",
    ]
    let offsets = new Array(g_width * g_height);
    for (let i=0; i<g_width * g_height; i++) offsets[i] = {x: roll(g_hex_width/4-1) - g_hex_width/8, y: roll(g_hex_width/4-1) - g_hex_width/8};

    for (let r=0; r<g_roads.length; r++)    
    {
        let steps = g_roads[r];

//        c.setLineDash([4, 4]);
        c.setLineDash([6, 16]);
//        c.setLineDash([8, 16]);
//        c.setLineDash([]);
        c.lineWidth = 6;
        c.strokeStyle = '#ff0';
		c.lineCap = 'round';
        //if (r >= g_roads.length - colours.length) c.strokeStyle = colours[r - g_roads.length + colours.length];
        c.beginPath();
        for (let s=0; s<steps.length; s++)
        {
            let hex_pos = steps[s];
            let pos = get_hex_center_h(hex_pos);
            
            let offset = offsets[hex_pos.y * g_width + hex_pos.x];
            //pos.x += offset.x * 1;
            //pos.y += offset.y * 1;
            
            if (s == 0)
            {
                c.moveTo(pos.x, pos.y);
            }
            else if (s == steps.length-1)
            {
                c.quadraticCurveTo(prev.x, prev.y, pos.x, pos.y);
            }
            else
            {
                pos.x += offset.x * 2;
                pos.y += offset.y * 2;
                c.quadraticCurveTo(prev.x, prev.y, (prev.x + pos.x) * 0.5, (prev.y + pos.y) * 0.5);
                //c.lineTo(pos.x, pos.y);
            }
            prev = pos
        }
        c.stroke();
    }

	c.globalCompositeOperation = "source-over";

    g_road_blob = await g_road_overlay.convertToBlob()
    update_export(g_road_blob, "export-road-overlay", "-roads.png");
}

async function draw_borders()
{
    c = g_border_overlay.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, g_border_overlay.width, g_border_overlay.height);
    c.setTransform(1, 0, 0, 1, g_hex_width/4, g_hex_height/2);
	
	let owner = new Uint8Array(g_width * g_height);
	for (let y=0; y<g_height; y++)
	{
		for (let x=0; x<g_width; x++)
		{
			let closest = 0;
			let closest_distance = distance(get_hex_center(x, y), get_hex_center_h(g_settlements[0]));
			for (let s=1; s<g_num_cities + g_num_towns; s++)
			{
				let d = distance(get_hex_center(x, y), get_hex_center_h(g_settlements[s]));
				if (d < closest_distance)
				{
					closest_distance = d;
					closest = s;
				}
			}
			
			owner[y * g_width + x] = closest;
		}
	}

//	c.setLineDash([12, 12]);
	c.setLineDash([]);
	c.lineWidth = 6;
	c.strokeStyle = '#c80000';

	for (let y=0; y<g_height; y++)
	{
		for (let x=0; x<g_width; x++)
		{
			for (let n=0; n<6; n++)
			{
				let pos = get_neighbour(x, y, n);
				if (pos.x < 0 || pos.y < 0 || pos.x >= g_width || pos.y >= g_height) continue;
				if (owner[y * g_width + x] == owner[pos.y * g_width + pos.x]) continue;
				
				let start = get_hex_vertex(x, y, (n + 5) % 6);
				let end = get_hex_vertex(x, y, n);
				c.beginPath();
				c.moveTo(start.x, start.y);
				c.lineTo(end.x, end.y);
				c.stroke();
			}
		}
	}

    g_border_blob = await g_border_overlay.convertToBlob()
    update_export(g_border_blob, "export-border-overlay", "-borders.png");
}

async function draw()
{
    if (g_display_mode == "display-normal")
    {
        for (let y=0; y<g_height; y++)
        {
            for (let x=0; x<g_width; x++)
            {
                let tile = g_hexmap[y * g_width + x];
                await draw_hex("tiles/" + tile + ".png", x, y, ctx);
            }
        }
        
        await draw_rivers();        
        await draw_settlements();
        await draw_roads();
		await draw_borders();
		
        ctx.drawImage(g_river_overlay, -g_hex_width/4, -g_hex_height/2);
        if (g_show_roads) ctx.drawImage(g_road_overlay, -g_hex_width/4, -g_hex_height/2);
        if (g_show_settlements) ctx.drawImage(g_settlement_overlay, -g_hex_width/4, -g_hex_height/2);
        if (g_show_borders) ctx.drawImage(g_border_overlay, -g_hex_width/4, -g_hex_height/2);
		
    }
    else
    {
        let source = (g_display_mode == "display-height") ? g_heightmap : g_biomemap;
        for (let y=0; y<g_height; y++)
        {
            for (let x=0; x<g_width; x++)
            {
                ctx.beginPath();
                for (let v=0; v<6; v++)
                {
                    let pos = get_hex_vertex(x, y, v);
                    if (v == 0)
                    {
                        ctx.moveTo(pos.x, pos.y)
                    }
                    else
                    {
                        ctx.lineTo(pos.x, pos.y)
                    }
                }
                ctx.closePath();
//                let v = Math.min(source[y * g_width + x] * 255, 255)
//                ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
                let v = viridis(Math.min(source[y * g_width + x], 1.0));
                ctx.fillStyle = `rgb(${Math.floor(v.r * 255)}, ${Math.floor(v.g * 255)}, ${Math.floor(v.b * 255)})`;
                ctx.fill();
                
                /*
                for (let v=0; v<6; v++)
                {
                    let pos = get_hex_vertex(x, y, v);
                    let h = compute_average(x, y, v, g_heightmap);
                    let col = viridis(Math.min(h, 1.0));
                    ctx.fillStyle = `rgb(${Math.floor(col.r * 255)}, ${Math.floor(col.g * 255)}, ${Math.floor(col.b * 255)})`;
                    ctx.fillRect(pos.x - 8, pos.y - 8, 16, 16);
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = '#0001';
                    ctx.strokeRect(pos.x - 8, pos.y - 8, 16, 16);
                }
                */
            }
        }        
    }
    
    if (g_show_hexes)
    {
		let dash = Math.floor(g_hex_width / 16);
		ctx.textAlign = "center";
		ctx.font = "12pt Ramaraja";
		ctx.setLineDash([dash, dash]);
		ctx.strokeStyle = "#000";
		ctx.lineWidth = 2;
		ctx.lineCap = "butt";

		//ctx.strokeStyle = "#0003";
        for (let y=0; y<g_height; y++)
        {
            for (let x=0; x<g_width; x++)
            {
                ctx.beginPath();
                for (let v=0; v<4; v++)
                {
                    let pos = get_hex_vertex(x, y, v);
                    if (v == 0)
                    {
                        ctx.moveTo(pos.x, pos.y)
                    }
                    else
                    {
                        ctx.lineTo(pos.x, pos.y)
                    }
                }
                ctx.stroke();
				
				if (g_show_numbers)
				{
					let hex = get_hex_center(x, y);
					ctx.fillText((x+1).toString().padStart(2, '0') + "" + (y+1).toString().padStart(2, '0'), hex.x, hex.y + g_hex_height/2 - 8);
				}
            }
        }
    }
    
    // Elevation lines
    if (g_display_elevation)
    {
        let c = g_elevation_overlay.getContext('2d');
        let image = c.createImageData(g_elevation_overlay.width, g_elevation_overlay.height);
        for (let y=0; y<g_elevation_overlay.height; y++)
        {
            for (let x=0; x<g_elevation_overlay.width; x++)
            {
                //let xc = (x & 16) < 8;
                //let yc = (y & 16) < 8;
                //if ((xc && !yc) || (yc && !xc)) continue;
                
                let v = interpolate(x, y, g_heightmap);
                if ((v % 0.08) < 0.004)
                {
                    image.data[(y * g_elevation_overlay.width + x) * 4 + 0] = 0;
                    image.data[(y * g_elevation_overlay.width + x) * 4 + 1] = 0;
                    image.data[(y * g_elevation_overlay.width + x) * 4 + 2] = 0;
                    image.data[(y * g_elevation_overlay.width + x) * 4 + 3] = 255;
                }
                else
                {
                    image.data[(y * g_elevation_overlay.width + x) * 4 + 0] = 0;
                    image.data[(y * g_elevation_overlay.width + x) * 4 + 1] = 0;
                    image.data[(y * g_elevation_overlay.width + x) * 4 + 2] = 0;
                    image.data[(y * g_elevation_overlay.width + x) * 4 + 3] = 0;
                }
            }
        }
        c.putImageData(image, 0, 0);
        ctx.drawImage(g_elevation_overlay, 0, 0);
    }
}

function update_generation()
{
    g_seed = document.getElementById("seed").value;
    g_height_power = parseFloat(document.getElementById("height-power").value);
    g_height_offset = parseFloat(document.getElementById("height-offset").value);
    g_height_range = Math.pow(2, parseFloat(document.getElementById("height-range").value));
    g_biome_offset = parseFloat(document.getElementById("biome-offset").value);
    g_smooth_rivers = document.getElementById("smooth-rivers").checked;
    g_num_rivers = parseInt(document.getElementById("num-rivers").value);
    g_swamp_threshold = parseFloat(document.getElementById("swamp-threshold").value);
    g_num_biome_iterations = parseInt(document.getElementById("num-biome-iterations").value);
    g_num_cities = parseInt(document.getElementById("num-cities").value);
    g_num_towns = parseInt(document.getElementById("num-towns").value);
    g_road_simplification_threshold = parseInt(document.getElementById("road-simplification-threshold").value);
	
    generate();
}

function update_display(e)
{
    if (document.getElementById("display-normal").checked) g_display_mode = "display-normal";
    if (document.getElementById("display-height").checked) g_display_mode = "display-height";
    if (document.getElementById("display-biome").checked) g_display_mode = "display-biome";
    g_show_hexes = document.getElementById("show-hexes").checked;
    g_display_elevation = document.getElementById("display-elevation").checked;
    g_show_numbers = document.getElementById("show-numbers").checked;
    g_show_settlements = document.getElementById("show-settlements").checked;
    g_show_roads = document.getElementById("show-roads").checked;
    g_show_borders = document.getElementById("show-borders").checked;
	
	generate();
    //draw();
}

function parse_url()
{
    const params = new URLSearchParams(window.location.search);
    g_seed = params.get('seed') || null;
    g_height_power = params.get('height_power') || 1;
    g_height_offset = params.get('height_offset') || 0;
    g_height_range = params.get('height_range') || 1;
    g_biome_offset = params.get('biome_offset') || 0;
    g_smooth_rivers = (params.get('smooth_rivers') === null) ? true : (params.get('smooth_rivers') == 'true');
    g_num_rivers = params.get('num_rivers') || 4;
    g_swamp_threshold = params.get('swamp_threshold') || 1.2;
    g_num_biome_iterations = params.get('num_biome_iterations') || 10;
    g_num_cities = parseInt(params.get('num_cities') || 5);
    g_num_towns = parseInt(params.get('num_towns') || 5);
    g_road_simplification_threshold = parseInt(params.get('road_simplification_threshold') || 16);
	
    generate();
}

function update_url()
{
    let new_url = window.location.protocol + "//" + window.location.host + window.location.pathname
    new_url += '?seed=' + g_seed
    new_url += '&height_power=' + g_height_power;
    new_url += '&height_offset=' + g_height_offset;
    new_url += '&height_range=' + g_height_range;
    new_url += '&biome_offset=' + g_biome_offset;
    new_url += '&smooth_rivers=' + g_smooth_rivers;
    new_url += '&num_rivers=' + g_num_rivers;
    new_url += '&swamp_threshold=' + g_swamp_threshold;
    new_url += '&num_biome_iterations=' + g_num_biome_iterations;
    new_url += '&num_cities=' + g_num_cities;
    new_url += '&num_towns=' + g_num_towns;
    new_url += '&road_simplification_threshold=' + g_road_simplification_threshold;
    if (window.history.pushState)
    {
        window.history.pushState(null, null, new_url)
    }
    else
    {
        window.history.replaceState(null, null, new_url)
    }
}

function randomize()
{
    g_seed = null;
    generate();
    update_url();
}

g_tiled_hexes =
[
    "costal_water",
    "desert_sandy",
    "grass",
    "forested_hills",
    "heavy_forest",
    "hills",
    "hills_green",
    "jungle",
    "jungle_hills",
    "light_forest",
    "mountains",
    "swamp",    
    "farmland",
];
g_tiled_symbols =
[
    "cave",
    "city",
    "danger",
    "marker",
    "ruins",
    "town",
    "village",
];

function update_tiled_export()
{
    var file_name = g_seed + ".tmx";
    
    var content = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.10.0" orientation="hexagonal" renderorder="right-down" width="25" height="20" tilewidth="${g_hex_width}" tileheight="${g_hex_height}" infinite="0" hexsidelength="${g_hex_width/2-2}" staggeraxis="x" staggerindex="odd" nextlayerid="2" nextobjectid="1">
    <tileset firstgid="1" source="hex_world_generator.tsx"/>
    <tileset firstgid="${g_tiled_hexes.length+1}" source="hex_world_generator_symbols.tsx"/>
    <layer id="1" name="biomes" width="25" height="20">
        <data encoding="csv">\n`;

    for (let y=0; y<g_height; y++)
    {
        content += "            ";
        for (let x=0; x<g_width; x++)
        {
            content += (g_tiled_hexes.indexOf(g_hexmap[y * g_width + x])+1) + ",";
        }
        content += "\n"
    }
    
    // Remove last comma
    content = content.substring(0, content.length-2) + "\n";
    
    content += `        </data>
    </layer>
    <imagelayer id="2" name="rivers">
        <image source="${g_seed}-rivers.png" width="${g_river_overlay.width}" height="${g_river_overlay.height}"/>
    </imagelayer>
    <layer id="3" name="settlements" width="25" height="20">
        <data encoding="csv">\n`;

//    <imagelayer id="3" name="settlements">
//        <image source="${g_seed}-settlements.png" width="${g_settlement_overlay.width}" height="${g_settlement_overlay.height}"/>
//    </imagelayer>

    let settlements = new Array(g_width * g_height);
    for (let i=0; i<g_width * g_height; i++) settlements[i] = null;
    for (let s=0; s<g_settlements.length; s++)
    {
        let settlement = g_settlements[s]
        settlements[settlement.y * g_width + settlement.x] = settlement.type;
    }

    for (let y=0; y<g_height; y++)
    {
        content += "            ";
        for (let x=0; x<g_width; x++)
        {
            content += (settlements[y * g_width + x] == null) ? 0 : (g_tiled_symbols.indexOf(settlements[y * g_width + x])+g_tiled_hexes.length+1);
            content += ",";
        }
        content += "\n"
    }
    
    // Remove last comma
    content = content.substring(0, content.length-2) + "\n";
    
    content += `        </data>
    </layer>

    <imagelayer id="4" name="roads">
        <image source="${g_seed}-roads.png" width="${g_road_overlay.width}" height="${g_road_overlay.height}"/>
    </imagelayer>
    <imagelayer id="5" name="borders">
        <image source="${g_seed}-borders.png" width="${g_border_overlay.width}" height="${g_border_overlay.height}"/>
    </imagelayer>
</map>`;
    
    var blob = new Blob([content], {type: 'text/plain'});
    var tiled = document.getElementById("export-tiled");
    tiled.setAttribute("href", window.URL.createObjectURL(blob));
    tiled.setAttribute("download", file_name);
}

function update_export(content, id, postfix)
{
    var file_name = g_seed + postfix;
    var blob = new Blob([content], {type: 'image/png'});
    var tiled = document.getElementById(id);
    tiled.setAttribute("href", window.URL.createObjectURL(blob));
    tiled.setAttribute("download", file_name);
}

function compute_quadrant(x, y)
{  
    let hex = find_hex(x, y);
    let center = get_hex_center(hex.x, hex.y);
    let dir = {x: x - center.x, y: y - center.y};
    let angle = (-Math.atan2(dir.y, dir.x) + Math.PI * 2 - Math.PI / 3) % (Math.PI * 2);
    
    return Math.floor(angle / (Math.PI / 3));
}

function dot(v1, v2)
{
    return v1.x*v2.x + v1.y*v2.y;
}

function compute_barycentric(a, b, c, p)
{
    let v0 = {x: b.x - a.x, y: b.y - a.y};
    let v1 = {x: c.x - a.x, y: c.y - a.y};
    let v2 = {x: p.x - a.x, y: p.y - a.y};
    let d00 = dot(v0, v0);
    let d01 = dot(v0, v1);
    let d11 = dot(v1, v1);
    let d20 = dot(v2, v0);
    let d21 = dot(v2, v1);
    let denom = d00 * d11 - d01 * d01;
    let v = (d11 * d20 - d01 * d21) / denom;
    let w = (d00 * d21 - d01 * d20) / denom;
    let u = 1.0 - v - w;
    
    return {u: u, v: v, w: w};
}

function interpolate(x, y, dataset)
{
    let hex = find_hex(x, y);
    let quadrant = compute_quadrant(x, y);

    let vc = dataset[hex.y * g_width + hex.x];
    let v1 = compute_average(hex.x, hex.y, (quadrant + 5) % 6, dataset);
    let v2 = compute_average(hex.x, hex.y, quadrant, dataset);
    
    let b = compute_barycentric(get_hex_center(hex.x, hex.y), get_hex_vertex_h(hex, (quadrant + 5) % 6), get_hex_vertex_h(hex, quadrant), {x: x, y: y});
    return vc * b.u + v1 * b.v + v2 * b.w;
}

function export_tiled_overlays()
{
    document.getElementById('export-river-overlay').click()
    document.getElementById('export-road-overlay').click()
    document.getElementById('export-border-overlay').click()
}
