m_hide_instrunction_timeout = null;

function on_set_movement()
{
	let base = document.getElementById("base-movement");
	let m = parseInt(base.value);
	let t = base.parentElement.parentElement.parentElement;
	t.children[1].children[2].children[0].value = Math.floor(m * 2 / 3);
	t.children[2].children[2].children[0].value = Math.floor(m / 2);
	t.children[3].children[2].children[0].value = Math.floor(m / 3);
	t.children[4].children[2].children[0].value = Math.min(m, 1);
	t.children[5].children[2].children[0].value = Math.floor(m * 2);
	t.children[6].children[2].children[0].value = Math.floor(m * 3);
	t.children[7].children[2].children[0].value = Math.floor(m * 4);
	t.children[8].children[2].children[0].value = Math.floor(m * 5);
}

function find_owner(e)
{
	if (e == null) return null;
	if (e.id != null && e.id.length > 0) return e;
	
	return find_owner(e.parentElement);
}

function show_instructions()
{
	let instructions = document.getElementById("instructions");
	instructions.classList.remove("hidden")
}

function hide_instructions()
{
	if (m_hide_instrunction_timeout != null)
	{
		clearTimeout(m_hide_instrunction_timeout);
		m_hide_instrunction_timeout = null;
	}

	let instructions = document.getElementById("instructions");
	instructions.classList.add("hidden")
}

function save()
{
	var file = {}
	let data = {};
	
	let inputs = document.querySelectorAll("input, textarea, img");
	for (let i=0; i<inputs.length; i++)
	{
		let input = inputs[i];
        
        if (input.classList.contains("non-serialized")) continue;
                
		let owner = find_owner(input);
		let id = owner.id;
		if (owner != input)
		{
			id += "/" + Array.from(owner.querySelectorAll("input, textarea")).findIndex(e => e == input);
		}

		if (input.nodeName == "INPUT" && input.getAttribute("type") == "checkbox")
		{
			data[id] = input.checked;
		}
        else if (input.nodeName == "IMG")
        {
			data[id] = input.src;
        }
		else
		{
			data[id] = input.value;
		}
	}
	
	let c = document.getElementById('pencil-colour');
	let font_list = document.getElementById("font-selector");

	file.version = 3;
	file.data = data;
	file.font = font_list.value;
	file.colour = c.value.trim();
	
	let uri = encodeURI("data:application/json;charset=utf-8," + JSON.stringify(file));
	uri = uri.replace(/#/g, '%23')
	let link = document.createElement("a");
	link.setAttribute("href", uri);
	let character_name = document.getElementById("character-name").value
	if (character_name == '') character_name = "unnamed"
	link.setAttribute("download", character_name + ".json");
	document.body.appendChild(link); // Required for FF
	link.click();
	link.remove();
}

function load(file)
{
	let version = file.version
	let data = file.data

    // Reset portrait
    set_image(document.getElementById("portrait-image"), "");
	
	if (version >= 3)
	{
		let font_list = document.getElementById("font-selector");
		font_list.value = file.font;
		font_list.onchange();
		
		let c = document.getElementById('pencil-colour');
		c.value = file.colour;
		c.onchange();
	}
	
	for (let i in data)
	{
		let value = data[i];
		let element = null;
		if (!i.includes('/'))
		{
			element = document.getElementById(i)
		}
		else
		{
			let id = i.split('/')[0];
			let index = i.split('/')[1];
			if (version == 1 && id == 'spell-list')
			{
				index--;
				index = Math.floor(index / 6) * 14 + (index % 6);
				index++;
			}
			element = document.getElementById(id).querySelectorAll("input, textarea")[index];
		}
		
		if (element.nodeName == "INPUT" && element.getAttribute("type") == "checkbox")
		{
			element.checked = value;
		}
		else if (element.nodeName == "IMG")
		{
            set_image(element, value);
		}
		else
		{
			element.value = value;
		}
	}	

	hide_instructions();
    update_gear_weight();
}

function close_modal(e)
{
	let bg = document.getElementById("modal-bg")
	bg.style.display = 'none'
}

function on_drag_enter(e)
{
	e.preventDefault()
	e.stopPropagation()
}
function on_drag_leave(e)
{
	e.preventDefault();
	e.stopPropagation();
}

function on_drop(e)
{
	on_drag_leave(e);
	
	e.preventDefault()
	e.stopPropagation()

    let blob = e.dataTransfer.files[0];
    let reader = new FileReader();
    reader.addEventListener("loadend", function()
    {
        let text = reader.result;
		let data = JSON.parse(text)
		load(data)
    });
    reader.readAsText(blob)
}

function get_num_cols(table)
{
	let cols = 0;
	let cells = table.rows[0].cells;
	for (let c=0; c<cells.length; c++)
	{
		let cell = cells[c];
		cols += (cell.colSpan !== undefined) ? cell.colSpan : 1;
	}
	
	return cols;
}

function update_tabindex()
{
	let inputs = document.querySelectorAll("input, textarea");
	let ordered = new Array(inputs.length);
	for (let i=0; i<inputs.length; i++)
	{
		let input = inputs[i];
		if (input.tabIndex == 0) continue;
		ordered[input.tabIndex - 1] = input;
	}
	let p = 0;
	for (let i=0; i<inputs.length; i++)
	{
		let input = inputs[i];
		if (input.tabIndex != 0) continue;
		while (ordered[p] != null) p++;
		ordered[p] = input;
	}
	for (let i=0; i<ordered.length; i++)
	{
		ordered[i].tabIndex = i + 1;
	}
	
	let tables = document.querySelectorAll("table[vertical-tabindex]");
	for (let t=0; t<tables.length; t++)
	{
		let table = tables[t];
		let reverse = table.getAttribute("reverse-vertical") != null;
		let index = table.querySelector("input, textarea").tabIndex;
		let grouping = parseInt(table.getAttribute("vertical-tabindex"));
		if (isNaN(grouping)) grouping = 1;		
		let cols = get_num_cols(table);
		for (let cc=0; cc<cols; cc+=grouping)
		{
			let c = (reverse) ? cols-cc-grouping : cc;
			for (let r=0; r<table.rows.length; r++)
			{
				for (let fc=c; fc<c+grouping; fc++)
				{
					let cell = table.rows[r].cells[fc];
					if (cell == null) continue;
					
					let inputs = cell.querySelectorAll("input, textarea");
					for (let i=0; i<inputs.length; i++)
					{
						let input = inputs[i];
						input.tabIndex = index++;
					}
				}
			}
		}
	}
}

m_strength =
[
	['-5', '-4',  '1 lb',   '3 lb',  '1',  '0%'],
	['-3', '-2',  '1 lb',   '5 lb',  '1',  '0%'],
	['-3', '-1',  '5 lb',  '10 lb',  '2',  '0%'],
	['-2', '-1', '10 lb',  '25 lb',  '3',  '0%'],
	['-2', '-1', '10 lb',  '25 lb',  '3',  '0%'],
	['-1',  '0', '20 lb',  '55 lb',  '4',  '0%'],
	['-1',  '0', '20 lb',  '55 lb',  '4',  '0%'],
	[ '0',  '0', '35 lb',  '90 lb',  '5',  '1%'],
	[ '0',  '0', '35 lb',  '90 lb',  '5',  '1%'],
	[ '0',  '0', '40 lb', '115 lb',  '6',  '2%'],
	[ '0',  '0', '40 lb', '115 lb',  '6',  '2%'],
	[ '0',  '0', '45 lb', '140 lb',  '7',  '4%'],
	[ '0',  '0', '45 lb', '140 lb',  '7',  '4%'],
	[ '0',  '0', '55 lb', '170 lb',  '8',  '7%'],
	[ '0',  '0', '55 lb', '170 lb',  '8',  '7%'],
	[ '0', '+1', '70 lb', '195 lb',  '9', '10%'],
	['+1', '+1', '85 lb', '220 lb', '10', '13%'],
	[
		['+1', '+2', '110 lb', '255 lb', '11', '16%'],
		['+1', '+3', '135 lb', '280 lb', '12', '20%'],
		['+2', '+3', '160 lb', '305 lb', '13', '25%'],
		['+2', '+4', '185 lb', '330 lb', '14', '30%'],
		['+2', '+5', '235 lb', '380 lb', '15(3)', '35%'],
		['+3', '+6', '335 lb', '480 lb', '16(6)', '40%'],
	],
	['+3',  '+7',   '484 lb',   '640 lb',  '16(8)', '50%'],
	['+3',  '+8',   '535 lb',   '700 lb', '17(10)', '60%'],
	['+4',  '+9',   '635 lb',   '810 lb', '17(12)', '70%'],
	['+4', '+10',   '785 lb',   '970 lb', '18(14)', '80%'],
	['+5', '+11',   '935 lb', '1,130 lb', '18(16)', '90%'],
	['+6', '+12', '1,235 lb', '1,440 lb', '19(17)', '95%'],
	['+7', '+14', '1,535 lb', '1,750 lb', '19(18)', '99%'],
];
m_dexterity =
[
	['-6', '-6', '+5'],
	['-4', '-4', '+5'],
	['-3', '-3', '+4'],
	['-2', '-2', '+3'],
	['-1', '-1', '+2'],
	[ '0',  '0', '+1'],
	[ '0',  '0', '+0'],
	[ '0',  '0',  '0'],
	[ '0',  '0',  '0'],
	[ '0',  '0',  '0'],
	[ '0',  '0',  '0'],
	[ '0',  '0',  '0'],
	[ '0',  '0',  '0'],
	[ '0',  '0',  '0'],
	[ '0',  '0', '-1'],
	['+1', '+1', '-2'],
	['+2', '+2', '-3'],
	['+2', '+2', '-4'],
	['+3', '+3', '-4'],
	['+3', '+3', '-4'],
	['+4', '+4', '-5'],
	['+4', '+4', '-5'],
	['+4', '+4', '-5'],
	['+5', '+5', '-6'],
	['+5', '+5', '-6'],
];
m_constitution =
[
	[    '-3',  '25%',  '30%', '-2', '-'],
	[    '-2',  '30%',  '35%', '-1', '-'],
	[    '-2',  '35%',  '40%',  '0', '-'],
	[    '-1',  '40%',  '45%',  '0', '-'],
	[    '-1',  '45%',  '50%',  '0', '-'],
	[    '-1',  '50%',  '55%',  '0', '-'],
	[     '0',  '55%',  '60%',  '0', '-'],
	[     '0',  '60%',  '65%',  '0', '-'],
	[     '0',  '65%',  '70%',  '0', '-'],
	[     '0',  '70%',  '75%',  '0', '-'],
	[     '0',  '75%',  '80%',  '0', '-'],
	[     '0',  '80%',  '85%',  '0', '-'],
	[     '0',  '85%',  '90%',  '0', '-'],
	[     '0',  '88%',  '92%',  '0', '-'],
	[    '+1',  '90%',  '94%',  '0', '-'],
	[    '+2',  '95%',  '96%',  '0', '-'],
	['+2(+3)',  '97%',  '98%',  '0', '-'],
	['+2(+4)',  '99%', '100%',  '0', '-'],
	['+2(+5)',  '99%', '100%', '+1', '-'],
	['+2(+5)',  '99%', '100%', '+1', '1/6 turns'],
	['+2(+6)',  '99%', '100%', '+2', '1/5 turns'],
	['+2(+6)',  '99%', '100%', '+2', '1/4 turns'],
	['+2(+6)',  '99%', '100%', '+3', '1/3 turns'],
	['+2(+7)',  '99%', '100%', '+3', '1/2 turns'],
	['+2(+7)', '100%', '100%', '+4', '1/1 turns'],
];
m_intelligence =
[
	[ '0',   '-',    '-',   '-', '-'],
	[ '1',   '-',    '-',   '-', '-'],
	[ '1',   '-',    '-',   '-', '-'],
	[ '1',   '-',    '-',   '-', '-'],
	[ '1',   '-',    '-',   '-', '-'],
	[ '1',   '-',    '-',   '-', '-'],
	[ '1',   '-',    '-',   '-', '-'],
	[ '1',   '-',    '-',   '-', '-'],
	[ '2', '4th',  '35%',   '6', '-'],
	[ '2', '5th',  '40%',   '7', '-'],
	[ '2', '5th',  '45%',   '7', '-'],
	[ '3', '6th',  '50%',   '7', '-'],
	[ '3', '6th',  '55%',   '9', '-'],
	[ '4', '7th',  '60%',   '9', '-'],
	[ '4', '7th',  '65%',  '11', '-'],
	[ '5', '8th',  '70%',  '11', '-'],
	[ '6', '8th',  '75%',  '14', '-'],
	[ '7', '9th',  '85%',  '18', '-'],
	[ '8', '9th',  '95%', 'All', '1st-lvl illusions'],
	[ '9', '9th',  '96%', 'All', '2nd-lvl illusions'],
	['10', '9th',  '97%', 'All', '3rd-lvl illusions'],
	['11', '9th',  '98%', 'All', '4th-lvl illusions'],
	['12', '9th',  '99%', 'All', '5th-lvl illusions'],
	['15', '9th', '100%', 'All', '6th-lvl illusions'],
	['20', '9th', '100%', 'All', '7th-lvl illusions'],
];
m_wisdom =
[
	['-6', '-', '80%', '-'],
	['-4', '-', '60%', '-'],
	['-3', '-', '50%', '-'],
	['-2', '-', '45%', '-'],
	['-1', '-', '40%', '-'],
	['-1', '-', '35%', '-'],
	['-1', '-', '30%', '-'],
	[ '0', '-', '25%', '-'],
	[ '0', '0', '20%', '-'],
	[ '0', '0', '15%', '-'],
	[ '0', '0', '10%', '-'],
	[ '0', '0', '5%', '-'],
	[ '0', '1', '0%', '-'],
	[ '0', '1 1', '0%', '-'],
	['+1', '1 1 2', '0%', '-'],
	['+2', '1 1 2 2', '0%', '-'],
	['+3', '1 1 2 2 3', '0%', '-'],
	['+4', '1 1 2 2 3 4', '0%', '-'],
	['+4', '1 1 1 2 2 3 4 4', '0%', 'Cause fear, Charm person, Command, Friends, Hypnotism'],
	['+4', '1 1 1 2 2 2 3 4 4 4', '0%', 'Cause fear, Charm person, Command, Friends, Hypnotism, Forget, Hold Person, Ray of enfeeblement, Scare'],
	['+4', '1 1 1 2 2 2 3 3 4 4 4 5', '0%', 'Cause fear, Charm person, Command, Friends, Hypnotism, Forget, Hold Person, Ray of enfeeblement, Scare, Fear'],
	['+4', '1 1 1 2 2 2 3 3 4 4 4 4 5 5', '0%', 'Cause fear, Charm person, Command, Friends, Hypnotism, Forget, Hold Person, Ray of enfeeblement, Scare, Fear, Charm monster, Confusion, Emotion, Fumble, Suggestion'],
	['+4', '1 1 1 2 2 2 3 3 4 4 4 4 5 5 5 5', '0%', 'Cause fear, Charm person, Command, Friends, Hypnotism, Forget, Hold Person, Ray of enfeeblement, Scare, Fear, Charm monster, Confusion, Emotion, Fumble, Suggestion, Chaos, Feeblemind, Hold monster, Magic jar, Quest'],
	['+4', '1 1 1 2 2 2 3 3 4 4 4 4 5 5 5 5 6 6', '0%', 'Cause fear, Charm person, Command, Friends, Hypnotism, Forget, Hold Person, Ray of enfeeblement, Scare, Fear, Charm monster, Confusion, Emotion, Fumble, Suggestion, Chaos, Feeblemind, Hold monster, Magic jar, Quest, Geas, Mass suggestion, Rod of rulership'],
	['+4', '1 1 1 2 2 2 3 3 4 4 4 4 5 5 5 5 6 6 6 7', '0%', 'Cause fear, Charm person, Command, Friends, Hypnotism, Forget, Hold Person, Ray of enfeeblement, Scare, Fear, Charm monster, Confusion, Emotion, Fumble, Suggestion, Chaos, Feeblemind, Hold monster, Magic jar, Quest, Geas, Mass suggestion, Rod of rulership, Antipathy/sympathy, Death spell, Mass charm'],
];
m_charisma =
[
	[ '0',  '-8', '-7'],
	[ '1',  '-7', '-6'],
	[ '1',  '-6', '-5'],
	[ '1',  '-5', '-4'],
	[ '2',  '-4', '-3'],
	[ '2',  '-3', '-2'],
	[ '3',  '-2', '-1'],
	[ '3',  '-1',  '0'],
	[ '4',   '0',  '0'],
	[ '4',   '0',  '0'],
	[ '4',   '0',  '0'],
	[ '5',   '0',  '0'],
	[ '5',   '0', '+1'],
	[ '6',  '+1', '+2'],
	[ '7',  '+3', '+3'],
	[ '8',  '+4', '+5'],
	['10',  '+6', '+6'],
	['15',  '+8', '+7'],
	['20', '+10', '+8'],
	['25', '+12', '+9'],
	['30', '+14', '+10'],
	['35', '+16', '+11'],
	['40', '+18', '+12'],
	['45', '+20', '+13'],
	['50', '+20', '+14'],
];
function update_from_data(inputs, data)
{
	for (let i=0; i<data.length; i++)
	{
		inputs[i].value = data[i];
	}
}
function update_strength(e)
{
	let value = e.target.value.toString();
	let percentage = '0';
	if (value.includes('/'))
	{
		percentage = value.split('/')[1];
		value = value.split('/')[0];
		if (percentage == '00') percentage = '100';
	}
	value = parseInt(value);
	percentage = parseInt(percentage);
	let data = null;
	if (value == 18)
	{
		if (percentage == 0) data = m_strength[18-1][0];
		else if (percentage <= 50) data = m_strength[18-1][1];
		else if (percentage <= 75) data = m_strength[18-1][2];
		else if (percentage <= 90) data = m_strength[18-1][3];
		else if (percentage <= 99) data = m_strength[18-1][4];
		else data = m_strength[18-1][5];
	}
	else if (value >= 1 && value <= 25)
	{
		data = m_strength[value-1];
	}
	
	if (data == null) return;
	
	let inputs = e.target.parentElement.parentElement.children[2].querySelectorAll("input");
	for (let i=0; i<data.length; i++)
	{
		inputs[i].value = data[i];
	}
}
function update_ability(e)
{
	let data_table = null;
	switch (e.target.parentElement.parentElement.children[1].innerText)
	{
		case 'STR': return update_strength(e);
		case 'DEX': data_table = m_dexterity; break;
		case 'CON': data_table = m_constitution; break;
		case 'INT': data_table = m_intelligence; break;
		case 'WIS': data_table = m_wisdom; break;
		case 'CHA': data_table = m_charisma; break;
	}

	let data = null;
	let value = parseInt(e.target.value.toString());
	if (value >= 1 && value <= 25)
	{
		data = data_table[value-1];
	}

	if (data == null) return;
	
	let inputs = e.target.parentElement.parentElement.children[2].querySelectorAll("input");
	for (let i=0; i<data.length; i++)
	{
		inputs[i].value = data[i];
	}
}

function update_gear_weight()
{
	let gear = document.getElementById("gear");
	let weights = gear.querySelectorAll("td:nth-child(3) input");
	let sum = 0;
	let valid = false;
	for (let i=0; i<weights.length; i++)
	{
		let weight = parseFloat(weights[i].value);
		if (isNaN(weight)) continue;
		
		sum += parseFloat(weights[i].value);
		valid = true;
	}
	
	document.getElementById("gear-total-weight").innerText = (valid) ? sum : "";
}

function cast(e)
{
	e.target.remove();
	e.stopPropagation();
}

function memorize(e)
{
	let x = document.createElement("X");
	x.addEventListener('click', cast);
	e.target.appendChild(x);
	e.stopPropagation();
	e.preventDefault();
}

function update_spell_list_mode()
{
	let edit = document.getElementById("spell-list-edit").checked;
	let spells = document.getElementById("spell-list");
	if (edit)
	{
		spells.classList.remove("play");
	}
	else
	{
		spells.classList.add("play");
	}
	let inputs = spells.querySelectorAll("input[type=text]");
	for (let i=0; i<inputs.length; i++)
	{
//		inputs[i].style.pointerEvents = (edit) ? null : "none";
		if (inputs[i].value == '') continue;
		
		if (edit)
		{
			inputs[i].parentElement.removeEventListener('click', memorize, false);
		}
		else
		{
			inputs[i].parentElement.addEventListener('click', memorize, false);
		}
	}
}

function update_printer_friendly(e)
{
	let pf = e.target.checked;
	let pages = document.querySelectorAll(".page");
	for (let p=0; p<pages.length; p++)
	{
		let page = pages[p];
		if (pf)
		{
			page.classList.add("printer-friendly");
		}
		else
		{
			page.classList.remove("printer-friendly");
		}
	}
}

function update_player_aid(e)
{
	let show_player_aid = e.target.checked;
    let player_aid = document.getElementById("player-aid");
    player_aid.style.display = (show_player_aid) ? "block" : "none";
}

function show_font_selector()
{
	let list = document.getElementById("font-list");
	list.classList.add('visible');
}

function hide_font_selector()
{
	let list = document.getElementById("font-list");
	list.classList.remove('visible');
}

function update_font()
{
	let list = document.getElementById("font-selector");
	let font = list.value;
	if (font == "Default") font = "Indie Flower";
	set_font(font);
	hide_font_selector();
}

function set_font(font)
{
	let r = document.querySelector(":root");
	r.style.setProperty('--font', font)
}

function change_pencil_colour(e)
{
	let c = document.getElementById('pencil-colour');
	let r = document.querySelector(":root");
	r.style.setProperty('--colour', c.value)
}

g_modal_callback = null
function close_modal(e)
{
	var modals = document.querySelectorAll(".modal")
	for (var m=0; m<modals.length; m++)
	{
		modals[m].style.display = 'none'
	}
	var bg = document.getElementById("modal-bg")
	bg.style.display = 'none'
	if (g_modal_callback != null)
	{
		g_modal_callback()
		g_modal_callback = null
	}
}
function show_modal(id, left, top, callback)
{
	g_modal_callback = callback
	var bg = document.getElementById("modal-bg")
	bg.style.display = 'block'
	var modal = document.getElementById(id)
	modal.style.display = 'block'
	modal.style.left = left
	modal.style.top = top
	var input = modal.querySelector("input");
	if (input != null)
	{
		modal.querySelector("input").select()
	}
}
function set_image(img, url)
{
    img.src = url
    img.setAttribute("data-x", 0)
    img.setAttribute("data-y", 0)
    img.setAttribute("data-zoom", 1)
    img.style.transform = 'translate(0, 0) scale(1)'    
    img.style.display = (url == "") ? "none" : "block";
}
function change_image_url(e)
{
	var url = document.querySelector("#url-modal input")
	var img = e.target.parentElement.querySelector("img")
	url.value = img.src
	show_modal("url-modal", e.pageX, e.pageY, function()
	{
        set_image(img, url.value)
	})
}

window.onload = function()
{
	document.addEventListener("keydown", function(e)
	{
		if ((window.navigator.platform.match("Mac") ? e.metaKey : e.ctrlKey) && e.keyCode == 83)
		{
			e.preventDefault()
			save()
		}
	}, false);
	
	document.onclick = (e) =>
	{
		if (e.target.id != "instructions" && e.target.id != "show-instructions") hide_instructions();
		if (e.path && !e.path.some(o => o.id == "font-selection")) hide_font_selector();
	}

	show_instructions();
//	m_hide_instrunction_timeout = setTimeout(() =>
//	{
//		hide_instructions();
//	}, 5000);
	
	update_tabindex();

	let r = document.querySelector(":root");
	let c = document.getElementById('pencil-colour');
	let colour = getComputedStyle(r).getPropertyValue('--colour').trim();
	c.value = colour;
}
