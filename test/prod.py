import sys

import requests

# read example.com from file
with open('example.py') as f:
    content = f.read().strip()

response = requests.post('https://luminosity-gzhqafckdxcnbsc8.eastus2-01.azurewebsites.net/render/video', data={
    'code': content,
    'className': 'Example'
})
print(response.json())