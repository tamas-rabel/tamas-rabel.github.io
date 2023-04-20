// ?seed=1680545304814
// ?seed=1680552840037
// ?seed=42&height_power=1&height_offset=0&height_range=1&biome_offset=0&smooth_rivers=true&num_rivers=4&swamp_threshold=1

var canvas = null;
var ctx = null;
var g_heightmap = null;
var g_biomemap = null;
var g_water_override = null;
var g_width = 25;
var g_height = 20;
var g_tiles = {};
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
var g_river_blob = null;
var g_elevation_overlay = null;
var g_display_elevation = false;
var g_num_biome_iterations = 10;
var g_show_numbers = true;

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
    
    g_heightmap = new Float32Array(g_width * g_height);
    g_biomemap = new Float32Array(g_width * g_height);
    g_water_override = new Float32Array(g_width * g_height);
 
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
                g_water_override[current_hex.y * g_width + current_hex.x] = 1;
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

function generate()
{
	set_seed(g_seed);
    
    // Reset water override
    for (let index=0; index<canvas.width * canvas.height; index++)
    {
        g_heightmap[index] = 0;
        g_biomemap[index] = 0;
        g_water_override[index] = 0;
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

    draw();
    
    update_tiled_export();
    update_river_export();
}

async function draw_tile(tile, x, y)
{
    let image = g_tiles[tile]
    if (image === undefined)
    {
        image = new Image();
        image.src = "tiles/" + tile + ".png"
        g_tiles[tile] = image;
    }
    
    if (!image.complete)
    {
        await new Promise(resolve => { image.onload = resolve; } );
    }
    
    let pos = get_hex_center(x, y);
    ctx.drawImage(image, pos.x - g_hex_width/2, pos.y - g_hex_height/2, g_hex_width, g_hex_height);
}

function compute_tile_h(hex)
{
    return compute_tile(hex.x, hex.y);
}

function compute_tile(x, y)
{
    let h = g_heightmap[y * g_width + x];
    let b = g_biomemap[y * g_width + x];
    let w = g_water_override[y * g_width + x];
    
    if (w > 0.5) return "costal_water";
    if (h < 0.2) return "costal_water";
    if (h < 0.5)
    {
        if (b > g_swamp_threshold - h) return "swamp";
        if (b < 0.1) return "desert_sandy";
        if (b < 0.4) return "farmland";
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
    update_river_export();
}

async function draw()
{
    if (g_display_mode == "display-normal")
    {
        for (let y=0; y<g_height; y++)
        {
            for (let x=0; x<g_width; x++)
            {
                await draw_tile(compute_tile(x, y), x, y);
            }
        }
        
        draw_rivers();
        ctx.drawImage(g_river_overlay, -g_hex_width/4, -g_hex_height/2);
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
		//ctx.strokeStyle = "#0003";
        for (let y=0; y<g_height; y++)
        {
            for (let x=0; x<g_width; x++)
            {
                ctx.beginPath();
                for (let v=0; v<4; v++)
                {
                    let pos = get_hex_vertex(x, y, v);
					console.log(pos);
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
        console.log(image);
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
    "farmland",
    "forested_hills",
    "heavy_forest",
    "hills",
    "hills_green",
    "jungle",
    "jungle_hills",
    "light_forest",
    "mountains",
    "swamp",    
];

function update_tiled_export()
{
    var file_name = g_seed + ".tmx";
    
    var content = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.10.0" orientation="hexagonal" renderorder="right-down" width="25" height="20" tilewidth="${g_hex_width}" tileheight="${g_hex_height}" infinite="0" hexsidelength="${g_hex_width/2-2}" staggeraxis="x" staggerindex="odd" nextlayerid="2" nextobjectid="1">
    <tileset firstgid="1" source="hex_world_generator.tsx"/>
    <layer id="1" name="hex_world_generator" width="25" height="20">
        <data encoding="csv">\n`;

    for (let y=0; y<g_height; y++)
    {
        content += "            ";
        for (let x=0; x<g_width; x++)
        {
            content += (g_tiled_hexes.indexOf(compute_tile(x, y))+1) + ",";
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
</map>`;
    
    var blob = new Blob([content], {type: 'text/plain'});
    var tiled = document.getElementById("export-tiled");
    tiled.setAttribute("href", window.URL.createObjectURL(blob));
    tiled.setAttribute("download", file_name);
}

function update_river_export()
{
    var file_name = g_seed + "-rivers.png";
    var content = g_river_blob;
    var blob = new Blob([content], {type: 'image/png'});
    var tiled = document.getElementById("export-river-overlay");
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
