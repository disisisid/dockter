import { SoftwareEnvironment, SoftwareApplication } from '../src/context'
import PythonGenerator from '../src/PythonGenerator'
import fs from 'fs'
import fixture from './fixture'

/**
 * When applied to an empty environment, generate should return
 * Dockerfile with just FROM
 */
test('generate:empty', async () => {
  const environ = new SoftwareEnvironment()
  const generator = new PythonGenerator(environ)
  expect(await generator.generate(false)).toEqual('FROM ubuntu:18.04\n')
})

/**
 * If the environ passed to the generator has requirements, use those to generate a requirements file then copy that to
 * the docker container and use for install
 */
test('generate:dockter-requirements', async () => {
  if (fs.existsSync(fixture('py-date/dockter-generated-requirements.txt'))) {
    fs.unlinkSync(fixture('py-date/dockter-generated-requirements.txt'))
  }
  const environ = new SoftwareEnvironment()

  const arrowPackage = new SoftwareApplication()
  arrowPackage.name = 'arrow'
  arrowPackage.version = '==0.12.1'
  arrowPackage.runtimePlatform = 'Python'

  environ.softwareRequirements = [arrowPackage]

  const generator = new PythonGenerator(environ, fixture('py-date'))

  expect(await generator.generate(false)).toEqual(`FROM ubuntu:18.04

RUN apt-get update \\
 && DEBIAN_FRONTEND=noninteractive apt-get install -y \\
      python3 \\
      python3-pip \\
 && apt-get autoremove -y \\
 && apt-get clean \\
 && rm -rf /var/lib/apt/lists/*

# dockter

COPY dockter-generated-requirements.txt .
RUN pip3 install -r dockter-generated-requirements.txt

COPY cmd.py cmd.py

CMD python3  cmd.py
`)
  const requirements = generator.read('dockter-generated-requirements.txt')
  expect(requirements).toEqual('arrow==0.12.1')

  if (fs.existsSync(fixture('py-date/dockter-generated-requirements.txt'))) {
    fs.unlinkSync(fixture('py-date/dockter-generated-requirements.txt'))
  }
})

/**
 * If the environ passed to the generator does not have requirements, but there is a `requirements.txt`, then copy that
 * file into the container and use it for installing the requirements
 */
test('generate:requirements-file', async () => {
  const environ = new SoftwareEnvironment()

  const generator = new PythonGenerator(environ, fixture('py-date'), 2)

  expect(await generator.generate(false)).toEqual(`FROM ubuntu:18.04

RUN apt-get update \\
 && DEBIAN_FRONTEND=noninteractive apt-get install -y \\
      python \\
      python-pip \\
 && apt-get autoremove -y \\
 && apt-get clean \\
 && rm -rf /var/lib/apt/lists/*

# dockter

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY cmd.py cmd.py

CMD python  cmd.py
`)
})
