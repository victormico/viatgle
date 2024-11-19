import math
import re
import os
import hashlib
import xml.etree.ElementTree as ET

from bs4 import BeautifulSoup
from svg.path import parse_path
from bs4 import BeautifulSoup
from unidecode import unidecode
from collections import deque


def extract_polygons_from_html(html_file):
    with open(html_file, 'r') as f:
        soup = BeautifulSoup(f, 'html.parser')
        polygons = soup.find_all('polygon')
        return polygons
    
def extract_paths_from_html(html_file):
    with open(html_file, 'r') as f:
        soup = BeautifulSoup(f, 'html.parser')
        paths = soup.find_all('path')
        return paths

# https://stackoverflow.com/a/69079951
def to_snake_case(string):
    string = unidecode(string)
    string = re.sub(r'(?<=[a-z])(?=[A-Z])|[^a-zA-Z]', ' ', string).strip().replace(' ', '_')
    return ''.join(string.lower())


def calculate_view_box(points):
    try:     
        x_values = []
        y_values = []

        for point in points.split(' '):
            # check that point has the comma separator
            if ',' in point:
                x, y = point.split(',')
                x_values.append(float(x))
                y_values.append(float(y))

        min_x = math.floor(min(x_values))
        min_y = math.floor(min(y_values))
        max_x = math.ceil(max(x_values))
        max_y = math.ceil(max(y_values))

        width = max_x - min_x
        height = max_y - min_y

        return min_x, min_y, width, height
    except Exception as e:
        print(f'Error point: {point}')
        print(f'Error: {e}')
        return 0, 0, 0, 0
    
# fumada de chatgpt que sembla que funciona
def calculate_view_box_from_d(d):
    """
    Calculate the bounding box (viewBox) for an SVG <path> 'd' attribute.
    """
    try:
        # Regex to match valid SVG coordinate pairs, skipping commands
        coordinates = []
        current_pos = [0, 0]  # Track the current position for relative commands
        commands = re.findall(r'[MLHVCSQTZAmlhvcsqtza]|[-+]?\d*\.\d+|[-+]?\d+', d)
        
        i = 0
        while i < len(commands):
            cmd = commands[i]
            if cmd in 'MLHVCSQTZ':  # Absolute commands
                if cmd == 'M' or cmd == 'L':
                    x, y = float(commands[i+1]), float(commands[i+2])
                    coordinates.append((x, y))
                    current_pos = [x, y]
                    i += 3
                elif cmd == 'H':
                    x = float(commands[i+1])
                    coordinates.append((x, current_pos[1]))
                    current_pos[0] = x
                    i += 2
                elif cmd == 'V':
                    y = float(commands[i+1])
                    coordinates.append((current_pos[0], y))
                    current_pos[1] = y
                    i += 2
                elif cmd == 'C':
                    for _ in range(3):  # Bezier curve has 3 coordinate pairs
                        x, y = float(commands[i+1]), float(commands[i+2])
                        coordinates.append((x, y))
                        i += 2
                    i += 1
                elif cmd == 'S':
                    for _ in range(2):  # Smooth cubic Bezier has 2 coordinate pairs
                        x, y = float(commands[i+1]), float(commands[i+2])
                        coordinates.append((x, y))
                        i += 2
                    i += 1
                elif cmd == 'Q':
                    for _ in range(2):  # Quadratic Bezier has 2 coordinate pairs
                        x, y = float(commands[i+1]), float(commands[i+2])
                        coordinates.append((x, y))
                        i += 2
                    i += 1
                elif cmd == 'T':
                    x, y = float(commands[i+1]), float(commands[i+2])
                    coordinates.append((x, y))
                    i += 3
                elif cmd == 'A':
                    x, y = float(commands[i+6]), float(commands[i+7])
                    coordinates.append((x, y))
                    i += 8
                elif cmd == 'Z':
                    # Z (close path) does not add new points
                    i += 1
            elif cmd in 'mlhvcsqtz':  # Relative commands
                if cmd == 'm' or cmd == 'l':
                    dx, dy = float(commands[i+1]), float(commands[i+2])
                    current_pos[0] += dx
                    current_pos[1] += dy
                    coordinates.append((current_pos[0], current_pos[1]))
                    i += 3
                elif cmd == 'h':
                    dx = float(commands[i+1])
                    current_pos[0] += dx
                    coordinates.append((current_pos[0], current_pos[1]))
                    i += 2
                elif cmd == 'v':
                    dy = float(commands[i+1])
                    current_pos[1] += dy
                    coordinates.append((current_pos[0], current_pos[1]))
                    i += 2
                elif cmd == 'c':
                    for _ in range(3):  # Bezier curve has 3 relative coordinate pairs
                        dx, dy = float(commands[i+1]), float(commands[i+2])
                        current_pos[0] += dx
                        current_pos[1] += dy
                        coordinates.append((current_pos[0], current_pos[1]))
                        i += 2
                    i += 1
                elif cmd == 's':
                    for _ in range(2):  # Smooth cubic Bezier has 2 relative coordinate pairs
                        dx, dy = float(commands[i+1]), float(commands[i+2])
                        current_pos[0] += dx
                        current_pos[1] += dy
                        coordinates.append((current_pos[0], current_pos[1]))
                        i += 2
                    i += 1
                elif cmd == 'q':
                    for _ in range(2):  # Quadratic Bezier has 2 relative coordinate pairs
                        dx, dy = float(commands[i+1]), float(commands[i+2])
                        current_pos[0] += dx
                        current_pos[1] += dy
                        coordinates.append((current_pos[0], current_pos[1]))
                        i += 2
                    i += 1
                elif cmd == 't':
                    dx, dy = float(commands[i+1]), float(commands[i+2])
                    current_pos[0] += dx
                    current_pos[1] += dy
                    coordinates.append((current_pos[0], current_pos[1]))
                    i += 3
                elif cmd == 'a':
                    dx, dy = float(commands[i+6]), float(commands[i+7])
                    current_pos[0] += dx
                    current_pos[1] += dy
                    coordinates.append((current_pos[0], current_pos[1]))
                    i += 8
                elif cmd == 'z':
                    # z (close path) does not add new points
                    i += 1
            else:  # Numbers without a valid command
                i += 1

        # Extract x and y values
        x_values = [point[0] for point in coordinates]
        y_values = [point[1] for point in coordinates]

        # Calculate min/max and dimensions
        min_x = math.floor(min(x_values))
        min_y = math.floor(min(y_values))
        max_x = math.ceil(max(x_values))
        max_y = math.ceil(max(y_values))

        width = max_x - min_x
        height = max_y - min_y

        return min_x, min_y, width, height

    except Exception as e:
        print(f"Error parsing 'd': {d}")
        print(f"Error: {e}")
        return 0, 0, 0, 0

    
def extract_data_info(data_info):
    try:
        soup = BeautifulSoup(data_info, 'html.parser')
        elements = soup.find_all('div')
        # remove html tags
        elements = [element.text for element in elements]
        if 'Comarca' in data_info:
            comarca = elements[0].split(': ')[1]
            capital = elements[1].split(': ')[1]
            pais = elements[2]
            
        elif 'Alguer' in data_info:
            comarca = elements[0]
            capital = elements[0]
            pais = elements[1]

        elif 'Andorra' in data_info:
            comarca = elements[0]
            capital = elements[1]
            pais = elements[0]
        return comarca, capital, pais
    except Exception as e:
        print(f'Error: {e}')
        print(f'data_info: {data_info}')
        return '', '', ''

def generate_svg_from_polygon(polygon, output_path):

    points = polygon['points']
    points = points.replace('\n', '').replace('\t', '')
    min_x, min_y, width, height = calculate_view_box(points)
    data_info = polygon['data-info'] if 'data-info' in polygon.attrs else ''
    
    polygon_class = polygon['class'][0]

    if polygon_class != 'catno':
        comarca, capital, pais = extract_data_info(data_info)
        comarca_id = to_snake_case(comarca)
        output_file = os.path.join(output_path, f'{comarca_id}.svg')

    else:
        comarca, capital, pais = '', '', ''
        uuid = hashlib.sha256(str(points).encode()).hexdigest()[-8:]
        comarca_id = f'catno_{uuid}'
        output_file = os.path.join(output_path, 'catno', f'{comarca_id}.svg')
    

    with open(output_file, 'w') as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{min_x} {min_y} {width} {height}">')
        f.write(f'\n  <polygon')
        f.write(f'\n    id="{comarca_id}"')
        f.write(f'\n    class="{polygon_class}"')
        f.write(f'\n    points="{points}"')
        f.write(f'\n    data-comarca="{comarca}"')
        f.write(f'\n    data-capital="{capital}"')
        f.write(f'\n    data-pais="{pais}"')
        f.write(f'\n    style="fill:#cccccc;stroke:#000000;stroke-width:0.5;"')
        f.write(f'\n  />')
        f.write(f'\n</svg>')

def generate_svg_from_path(path, output_path):
    d = path['d']
    d = d.replace('\n', '').replace('\t', '')
    min_x, min_y, width, height = calculate_view_box_from_d(d)
    data_info = path['data-info'] if 'data-info' in path.attrs else ''
    
    polygon_class = path['class'][0]

    if polygon_class == 'catno':
        comarca, capital, pais = '', '', ''
        uuid = hashlib.sha256(str(d).encode()).hexdigest()[-8:]
        comarca_id = f'catno_{uuid}'
        output_file = os.path.join(output_path, 'catno', f'{comarca_id}.svg')

    elif polygon_class == "st0":
        return None
    
    else:
        comarca, capital, pais = extract_data_info(data_info)
        comarca_id = to_snake_case(comarca)
        output_file = os.path.join(output_path, f'{comarca_id}.svg')

    

    with open(output_file, 'w') as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{min_x} {min_y} {width} {height}">')
        f.write(f'\n  <path')
        f.write(f'\n    id="{comarca_id}"')
        f.write(f'\n    class="{polygon_class}"')
        f.write(f'\n    d="{d}"')
        f.write(f'\n    data-comarca="{comarca}"')
        f.write(f'\n    data-capital="{capital}"')
        f.write(f'\n    data-pais="{pais}"')
        f.write(f'\n    style="fill:#cccccc;stroke:#000000;stroke-width:0.5;"')
        f.write(f'\n  />')
        f.write(f'\n</svg>')

def validate_connections(data):
    """
    Validates that all the comarca connections in the input data are symmetric.
    That is, if comarca A is connected to comarca B, then comarca B must be
    connected to comarca A.
    """
    errors = []

    for comarca, neighbors in data.items():
        for neighbor in neighbors:
            if comarca not in data.get(neighbor, []):
                errors.append(
                    f"Connection missing: '{neighbor}' should include '{comarca}'"
                )

    return errors

def find_shortest_path(start, end, graph):
    """
    Troba el camí més curt entre dues comarques utilitzant una cerca en amplada (BFS).

    :param start: Comarca inicial (str)
    :param end: Comarca final (str)
    :param graph: Diccionari de comarques i les seves adjacents
    :return: Llista amb el camí més curt, o None si no hi ha cap camí
    """
    queue = deque([[start]])  # Pila de camins possibles
    visited = set()           # Conjunt de comarques visitades

    while queue:
        # Obtenim el primer camí de la cua
        path = queue.popleft()
        node = path[-1]

        # Si hem arribat a la comarca final, retornem el camí
        if node == end:
            return path

        # Si no hem visitat aquest node, explorem els seus veïns
        if node not in visited:
            visited.add(node)

            # Afegim camins nous a la cua
            for neighbor in graph.get(node, []):
                new_path = list(path)  # Fem una còpia del camí actual
                new_path.append(neighbor)
                queue.append(new_path)

    return None  # Retorna None si no hi ha cap camí

def replace_viewbox(svg_file, viewbox):
    tree = ET.parse(svg_file)
    root = tree.getroot()
    root.set('viewBox', viewbox)
    xmlstr = ET.tostring(root, encoding='unicode', method='xml')
    return xmlstr

def modify_svg(catno, path):
    for catno_id, info in catno.items():
        info = catno[catno_id]
        catno_file = os.path.join(path, 'catno', f'{catno_id}.svg')
        output_file = os.path.join(path, f'{info['id']}.svg')
        
        
        # Read the file and get the poligon
        polygons = extract_polygons_from_html(catno_file)
        polygon = polygons[0]
        points = polygon['points']
        points = points.replace('\n', '').replace('\t', '')
        min_x, min_y, width, height = calculate_view_box(points)

        multiple_shape_counter = 0
        while os.path.exists(output_file):
            output_polygons = extract_polygons_from_html(output_file)
            output_polygon = output_polygons[0]
            output_points = output_polygon['points']
            output_points = output_points.replace('\n', '').replace('\t', '')

            if points == output_points:
                print(f'File {output_file} already exists')
                return None
            if multiple_shape_counter == 0:
                multiple_shape_counter = 1
                output_file = output_file.replace('.svg', f'_{multiple_shape_counter}.svg')
            else:
                multiple_shape_counter += 1
                output_file = output_file.replace(f'_{multiple_shape_counter - 1}.svg', f'_{multiple_shape_counter}.svg')
        

        with open(output_file, 'w') as f:
            f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{min_x} {min_y} {width} {height}">')
            f.write(f'\n  <polygon')
            f.write(f'\n    id="{info['id']}"')
            f.write(f'\n    class="{info['class']}"')
            f.write(f'\n    points="{points}"')
            f.write(f'\n    data-comarca="{info['comarca']}"')
            f.write(f'\n    data-capital="{info['capital']}"')
            f.write(f'\n    data-pais="{info['pais']}"')
            f.write(f'\n    style="fill:#cccccc;stroke:#000000;stroke-width:0.5;"')
            f.write(f'\n  />')
            f.write(f'\n</svg>')

def create_master_svg(input_folder, output_file):
    """
    Combine individual SVG files into a master SVG file, handling both <polygon> and <path> elements.
    """
    # Create a new master SVG element
    master_svg = ET.Element('svg', xmlns="http://www.w3.org/2000/svg", attrib={
        "viewBox": "0 0 595.3 673"
    })

    # Iterate through all SVG files in the input folder
    comarca_groups = {}
    for file in os.listdir(input_folder):
        if file.endswith(".svg"):
            file_path = os.path.join(input_folder, file)
            
            # Parse the SVG file
            tree = ET.parse(file_path)
            root = tree.getroot()
            
            # Process <polygon> and <path> elements
            for shape_tag in ['polygon', 'path']:
                shapes = root.findall(f'.//{{http://www.w3.org/2000/svg}}{shape_tag}')
                for shape in shapes:
                    comarca_id = shape.attrib.get('id', os.path.splitext(file)[0])
                    
                    # Add the shape to the appropriate group
                    if comarca_id not in comarca_groups:
                        comarca_groups[comarca_id] = []
                    comarca_groups[comarca_id].append((shape_tag, shape))

    # Create `<g>` elements for each comarca
    for comarca_id, shapes in comarca_groups.items():
        # Create a `<g>` element
        g_element = ET.Element('g', id=comarca_id, attrib={
            'data-comarca': shapes[0][1].attrib.get('data-comarca', ''),
            'data-capital': shapes[0][1].attrib.get('data-capital', ''),
            'data-pais': shapes[0][1].attrib.get('data-pais', '')
        })
        # Append all <polygon> and <path> elements to the group
        for shape_tag, shape in shapes:
            new_shape = ET.Element(shape_tag, attrib=shape.attrib)
            g_element.append(new_shape)
        # Add the group to the master SVG
        master_svg.append(g_element)

    # Write the master SVG to a file
    tree = ET.ElementTree(master_svg)
    ET.indent(tree, space="  ", level=0)  # Pretty-print the XML
    tree.write(output_file, encoding='utf-8', xml_declaration=True)
    print(f"Master SVG created: {output_file}")