import sys

import requests

# read example.com from file
with open('example.py') as f:
    content = f.read().strip()

response = requests.post('http://localhost:3001/render/video', data={
    'code': content,
    'className': 'Example'
})
print(response.json())