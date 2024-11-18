from bs4 import BeautifulSoup
from unidecode import unidecode
from collections import deque
import xml.etree.ElementTree as ET

import math
import re
import os
import logging
import hashlib

def extract_polygons_from_html(html_file):
    with open(html_file, 'r') as f:
        soup = BeautifulSoup(f, 'html.parser')
        polygons = soup.find_all('polygon')
        return polygons


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

def generate_svg(polygon, path):

    points = polygon['points']
    points = points.replace('\n', '').replace('\t', '')
    min_x, min_y, width, height = calculate_view_box(points)
    data_info = polygon['data-info'] if 'data-info' in polygon.attrs else ''
    
    polygon_class = polygon['class'][0]

    if polygon_class != 'catno':
        comarca, capital, pais = extract_data_info(data_info)
        comarca_id = to_snake_case(comarca)
        output_file = os.path.join(path, f'{comarca_id}.svg')

    else:
        comarca, capital, pais = '', '', ''
        uuid = hashlib.sha256(str(points).encode()).hexdigest()[8:]
        comarca_id = f'catno_{uuid}'
        output_file = os.path.join(path, 'catno', f'{comarca_id}.svg')
    

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
