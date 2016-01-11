#!/usr/bin/ruby
require_relative('erlang')

node = "hoge@fuga"
cookie = File.read(ENV['HOME']+"/.erlang.cookie")
erl = Erlang::Erl.new(node, cookie)

p erl.nodes
if erl.nodes.empty?
  raise "no available node."
end

if erl.rpc_call(erl.nodes[0], :io, :format, ["Hello!\n"]) != :ok
  raise " != :ok"
end

p erl.rpc_call(erl.nodes[0], :erlang, :processes, [])

